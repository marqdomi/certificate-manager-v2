# backend/services/cache_builder.py
from __future__ import annotations

from datetime import datetime
from typing import Iterable, Optional

from db.base import SessionLocal
from db.models import (
    Device,
    Certificate,
    SslProfilesCache,
    SslProfileVipsCache,
    CertProfileLinksCache,
)
from services.encryption_service import decrypt_data
from services import f5_service_logic
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

# Celery app (para registrar tasks aquí)
from core.celery_worker import celery_app


def _fullpath(partition: str, name: str) -> str:
    partition = partition or "Common"
    if name.startswith("/"):
        return name
    return f"/{partition}/{name}"


def _acquire_device_lock(db, device_id: int) -> None:
    """Use a PostgreSQL advisory *transaction* lock to serialize refreshes per device.
    This avoids race conditions (e.g., duplicate inserts) when two workers refresh the same device.
    The lock is held for the duration of the current DB transaction.
    """
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": int(device_id)})


def _fallback_build_from_device(db, dev, password):
    """
    Fallback strategy: if no certificates are indexed locally, build the cache by querying all SSL profiles from the device,
    then for each profile, get its certificate and associated VIPs.
    """
    from services import f5_service_logic
    from db.models import SslProfilesCache, SslProfileVipsCache, CertProfileLinksCache
    now = datetime.utcnow()

    profiles = f5_service_logic.get_all_ssl_profiles(
        hostname=dev.ip_address,
        username=dev.username,
        password=password,
    ) or []

    profiles_seen = set()
    links_seen = set()
    vips_seen = set()

    rows_profiles = []
    rows_links = []
    rows_vips = []

    for profile in profiles:
        partition = profile.get("partition", "Common")
        name = profile.get("name")
        if not name:
            continue
        fullpath = _fullpath(partition, name)

        key_p = (partition, name)
        if key_p not in profiles_seen:
            rows_profiles.append({
                "device_id": dev.id,
                "profile_name": name,
                "partition": partition,
                "context": profile.get("context", "clientside"),
                "updated_at": now,
            })
            profiles_seen.add(key_p)

        cert_name = profile.get("certificate")
        if cert_name:
            key_l = (cert_name, fullpath)
            if key_l not in links_seen:
                rows_links.append({
                    "device_id": dev.id,
                    "cert_name": cert_name,
                    "profile_full_path": fullpath,
                    "updated_at": now,
                })
                links_seen.add(key_l)

        vips = f5_service_logic.get_ssl_profile_vips(
            hostname=dev.ip_address,
            username=dev.username,
            password=password,
            profile_fullpath=fullpath,
        ) or []
        for vip in vips:
            key_v = (fullpath, vip)
            if key_v in vips_seen:
                continue
            rows_vips.append({
                "device_id": dev.id,
                "profile_full_path": fullpath,
                "vip_name": vip,
                "updated_at": now,
            })
            vips_seen.add(key_v)

    # Bulk upserts (ignore duplicates) -- rely on the unique constraints
    if rows_profiles:
        db.execute(
            pg_insert(SslProfilesCache)
            .values(rows_profiles)
            .on_conflict_do_nothing(index_elements=[
                SslProfilesCache.device_id,
                SslProfilesCache.partition,
                SslProfilesCache.profile_name,
            ])
        )
    if rows_links:
        db.execute(
            pg_insert(CertProfileLinksCache)
            .values(rows_links)
            .on_conflict_do_nothing(index_elements=[
                CertProfileLinksCache.device_id,
                CertProfileLinksCache.cert_name,
                CertProfileLinksCache.profile_full_path,
            ])
        )
    if rows_vips:
        db.execute(
            pg_insert(SslProfileVipsCache)
            .values(rows_vips)
            .on_conflict_do_nothing(index_elements=[
                SslProfileVipsCache.device_id,
                SslProfileVipsCache.profile_full_path,
                SslProfileVipsCache.vip_name,
            ])
        )

    return {
        "status": "success",
        "message": (
            f"Fallback cache built for device {dev.hostname}. "
            f"profiles={len(profiles_seen)}, links={len(links_seen)}, vips={len(vips_seen)}"
        ),
    }


def refresh_device_profiles_cache(device_id: int, limit_certs: Optional[int] = None) -> dict:
    """
    Reconstruye el caché de asociaciones Cert ↔ Profiles ↔ VIPs para un device.
    Estrategia: primero intenta iterar certificados locales; si no hay, usa fallback consultando perfiles SSL directamente del dispositivo.
    """
    db = SessionLocal()
    try:
        dev = db.get(Device, device_id)
        if not dev:
            return {"status": "error", "message": f"Device {device_id} not found"}
        if not dev.username or not dev.encrypted_password:
            return {"status": "error", "message": "Device without credentials"}
        try:
            password = decrypt_data(dev.encrypted_password)
        except Exception as e:
            return {"status": "error", "message": f"Cannot decrypt password: {e}"}

        total_certs = 0
        profiles_seen = set()   # (partition, name)
        links_seen = set()      # (cert_name, fullpath)
        vips_seen = set()       # (fullpath, vip)

        rows_profiles = []
        rows_links = []
        rows_vips = []

        with db.begin():
            # Serialize per-device rebuild to avoid race conditions between workers
            _acquire_device_lock(db, device_id)

            # Clear old cache for this device
            db.query(SslProfilesCache).filter(SslProfilesCache.device_id == device_id).delete(synchronize_session=False)
            db.query(SslProfileVipsCache).filter(SslProfileVipsCache.device_id == device_id).delete(synchronize_session=False)
            db.query(CertProfileLinksCache).filter(CertProfileLinksCache.device_id == device_id).delete(synchronize_session=False)

            # Pull certificates indexed locally for this device
            certs_q = db.query(Certificate).filter(Certificate.device_id == device_id).order_by(Certificate.name.asc())
            if limit_certs:
                certs_q = certs_q.limit(int(limit_certs))
            certs: Iterable[Certificate] = certs_q.all()

            if not certs:
                # No local certs: build from device profiles directly (fallback)
                result = _fallback_build_from_device(db, dev, password)
                # All writes were staged via upserts inside the same transaction
                return result

            now = datetime.utcnow()
            for cert in certs:
                total_certs += 1
                usage = f5_service_logic.get_certificate_usage(
                    hostname=dev.ip_address,
                    username=dev.username,
                    password=password,
                    cert_name=cert.name,
                    partition=cert.partition or "Common",
                ) or {}

                profile_fullpaths = usage.get("profiles", []) or []
                virtual_servers = usage.get("virtual_servers", []) or []

                # Build VS map: profile_fullpath -> [vip names]
                vs_by_profile = {}
                for vs in virtual_servers:
                    vs_name = vs.get("name") or vs.get("fullPath") or "unknown"
                    for pf in (vs.get("profiles", []) or []):
                        vs_by_profile.setdefault(pf, []).append(vs_name)

                for pf in profile_fullpaths:
                    # Parse partition/name
                    partition = "Common"
                    name = pf
                    parts = pf.split("/")
                    if len(parts) >= 3:
                        partition = parts[1] or "Common"
                        name = parts[2]
                    fullpath = _fullpath(partition, name)

                    key_p = (partition, name)
                    if key_p not in profiles_seen:
                        rows_profiles.append({
                            "device_id": device_id,
                            "profile_name": name,
                            "partition": partition,
                            "context": "clientside",
                            "updated_at": now,
                        })
                        profiles_seen.add(key_p)

                    key_l = (cert.name, fullpath)
                    if key_l not in links_seen:
                        rows_links.append({
                            "device_id": device_id,
                            "cert_name": cert.name,
                            "profile_full_path": fullpath,
                            "updated_at": now,
                        })
                        links_seen.add(key_l)

                    for vip in (vs_by_profile.get(pf, []) or []):
                        key_v = (fullpath, vip)
                        if key_v in vips_seen:
                            continue
                        rows_vips.append({
                            "device_id": device_id,
                            "profile_full_path": fullpath,
                            "vip_name": vip,
                            "updated_at": now,
                        })
                        vips_seen.add(key_v)

            # Bulk upserts (ignore duplicates) within the same transaction
            if rows_profiles:
                db.execute(
                    pg_insert(SslProfilesCache)
                    .values(rows_profiles)
                    .on_conflict_do_nothing(index_elements=[
                        SslProfilesCache.device_id,
                        SslProfilesCache.partition,
                        SslProfilesCache.profile_name,
                    ])
                )
            if rows_links:
                db.execute(
                    pg_insert(CertProfileLinksCache)
                    .values(rows_links)
                    .on_conflict_do_nothing(index_elements=[
                        CertProfileLinksCache.device_id,
                        CertProfileLinksCache.cert_name,
                        CertProfileLinksCache.profile_full_path,
                    ])
                )
            if rows_vips:
                db.execute(
                    pg_insert(SslProfileVipsCache)
                    .values(rows_vips)
                    .on_conflict_do_nothing(index_elements=[
                        SslProfileVipsCache.device_id,
                        SslProfileVipsCache.profile_full_path,
                        SslProfileVipsCache.vip_name,
                    ])
                )

        return {
            "status": "success",
            "message": (
                f"Cache built for device {dev.hostname}. certs={total_certs}, "
                f"profiles={len(profiles_seen)}, links={len(links_seen)}, vips={len(vips_seen)}"
            ),
        }

    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


@celery_app.task(name="cache.refresh_device_profiles")
def task_refresh_device_profiles(device_id: int, limit_certs: Optional[int] = None) -> dict:
    return refresh_device_profiles_cache(device_id, limit_certs)


@celery_app.task(name="cache.refresh_all_profiles")
def task_refresh_all_profiles(limit_certs: Optional[int] = None) -> dict:
    """
    Encola un refresh por cada device (para paralelizar).
    """
    db = SessionLocal()
    try:
        devices = db.query(Device).all()
        scheduled = 0
        for d in devices:
            celery_app.send_task("cache.refresh_device_profiles", kwargs={"device_id": d.id, "limit_certs": limit_certs})
            scheduled += 1
        return {"status": "queued", "scheduled": scheduled}
    finally:
        db.close()
def refresh_all_profiles():
    """
    Itera sobre todos los dispositivos activos y ejecuta el refresh de cache por cada uno.
    Retorna un dict con los resultados por device_id.
    """
    from db.base import SessionLocal
    from services.cache_builder import refresh_device_profiles_cache
    from sqlalchemy import text
    s = SessionLocal()
    try:
        devices = s.execute(text("SELECT id FROM devices")).fetchall()
        results = {}
        for (device_id,) in devices:
            result = refresh_device_profiles_cache(device_id)
            results[device_id] = result
        return results
    finally:
        s.close()