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
from sqlalchemy import text, tuple_
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

    This version performs delta updates (UPSERT on conflicts and DELETE of stale rows) instead of truncating.
    """
    from services import f5_service_logic
    from db.models import SslProfilesCache, SslProfileVipsCache, CertProfileLinksCache
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    now = datetime.utcnow()

    profiles = f5_service_logic.get_all_ssl_profiles(
        hostname=dev.ip_address,
        username=dev.username,
        password=password,
    ) or []

    # --- NEW: Preload existing keys to compute deletions (delta) ---
    existing_profiles = set(
        db.query(SslProfilesCache.partition, SslProfilesCache.profile_name)
          .filter(SslProfilesCache.device_id == dev.id)
          .all()
    )
    existing_links = set(
        db.query(CertProfileLinksCache.cert_name, CertProfileLinksCache.profile_full_path)
          .filter(CertProfileLinksCache.device_id == dev.id)
          .all()
    )
    existing_vips = set(
        db.query(SslProfileVipsCache.profile_full_path, SslProfileVipsCache.vip_name)
          .filter(SslProfileVipsCache.device_id == dev.id)
          .all()
    )

    profiles_seen = set()  # (partition, name)
    links_seen = set()     # (cert_name, profile_full_path)
    vips_seen = set()      # (profile_full_path, vip_name)

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
            # vip puede ser str (fullPath/name) o dict enriquecido
            if isinstance(vip, str):
                vip_name = vip
                vip_full_path = None
                vip_partition = None
                dest = None
                svc_port = None
                en = None
                st = None
            else:
                vip_name = vip.get("name") or vip.get("fullPath") or vip.get("vip") or "unknown"
                vip_full_path = vip.get("fullPath")
                vip_partition = vip.get("partition")
                dest = vip.get("destination")
                svc_port = vip.get("servicePort")
                en = vip.get("enabled")
                st = vip.get("status")

            key_v = (fullpath, vip_name)
            if key_v in vips_seen:
                continue
            rows_vips.append({
                "device_id": dev.id,
                "profile_full_path": fullpath,
                "vip_name": vip_name,
                "vip_full_path": vip_full_path,
                "partition": vip_partition,
                "destination": dest,
                "service_port": svc_port,
                "enabled": en,
                "status": st,
                "updated_at": now,
            })
            vips_seen.add(key_v)

    # --- UPSERTs with DO UPDATE to refresh metadata on existing rows ---
    if rows_profiles:
        stmt = pg_insert(SslProfilesCache).values(rows_profiles)
        db.execute(
            stmt.on_conflict_do_update(
                index_elements=[SslProfilesCache.device_id, SslProfilesCache.partition, SslProfilesCache.profile_name],
                set_={"context": stmt.excluded.context, "updated_at": now},
            )
        )
    if rows_links:
        stmt = pg_insert(CertProfileLinksCache).values(rows_links)
        db.execute(
            stmt.on_conflict_do_update(
                index_elements=[CertProfileLinksCache.device_id, CertProfileLinksCache.cert_name, CertProfileLinksCache.profile_full_path],
                set_={"updated_at": now},
            )
        )
    if rows_vips:
        stmt = pg_insert(SslProfileVipsCache).values(rows_vips)
        db.execute(
            stmt.on_conflict_do_update(
                index_elements=[SslProfileVipsCache.device_id, SslProfileVipsCache.profile_full_path, SslProfileVipsCache.vip_name],
                set_={
                    "vip_full_path": stmt.excluded.vip_full_path,
                    "partition": stmt.excluded.partition,
                    "destination": stmt.excluded.destination,
                    "service_port": stmt.excluded.service_port,
                    "enabled": stmt.excluded.enabled,
                    "status": stmt.excluded.status,
                    "updated_at": now,
                },
            )
        )

    # --- DELETE stale rows (existing - seen) ---
    # Perf: only run DELETEs if there is something to remove.
    stale_p = existing_profiles - profiles_seen
    stale_l = existing_links - links_seen
    stale_v = existing_vips - vips_seen

    if stale_p:
        db.query(SslProfilesCache).filter(
            SslProfilesCache.device_id == dev.id,
            tuple_(SslProfilesCache.partition, SslProfilesCache.profile_name).in_(list(stale_p))
        ).delete(synchronize_session=False)
    if stale_l:
        db.query(CertProfileLinksCache).filter(
            CertProfileLinksCache.device_id == dev.id,
            tuple_(CertProfileLinksCache.cert_name, CertProfileLinksCache.profile_full_path).in_(list(stale_l))
        ).delete(synchronize_session=False)
    if stale_v:
        db.query(SslProfileVipsCache).filter(
            SslProfileVipsCache.device_id == dev.id,
            tuple_(SslProfileVipsCache.profile_full_path, SslProfileVipsCache.vip_name).in_(list(stale_v))
        ).delete(synchronize_session=False)

    return {
        "status": "success",
        "message": (
            f"Fallback cache built (delta) for device {dev.hostname}. "
            f"profiles={len(profiles_seen)}, links={len(links_seen)}, vips={len(vips_seen)}, "
            f"deleted={len(stale_p) + len(stale_l) + len(stale_v)}"
        ),
    }


def refresh_device_profiles_cache(device_id: int, limit_certs: Optional[int] = None) -> dict:
    db = SessionLocal()
    try:
        with db.begin():
            _acquire_device_lock(db, device_id)

            dev = db.get(Device, device_id)
            if not dev:
                return {"status": "error", "message": f"Device {device_id} not found"}
            if not dev.username or not dev.encrypted_password:
                return {"status": "error", "message": "Device without credentials"}
            try:
                password = decrypt_data(dev.encrypted_password)
            except Exception as e:
                return {"status": "error", "message": f"Cannot decrypt password: {e}"}

            # --- NEW: Preload existing keys for delta computation ---
            existing_profiles = set(
                db.query(SslProfilesCache.partition, SslProfilesCache.profile_name)
                  .filter(SslProfilesCache.device_id == device_id)
                  .all()
            )
            existing_links = set(
                db.query(CertProfileLinksCache.cert_name, CertProfileLinksCache.profile_full_path)
                  .filter(CertProfileLinksCache.device_id == device_id)
                  .all()
            )
            existing_vips = set(
                db.query(SslProfileVipsCache.profile_full_path, SslProfileVipsCache.vip_name)
                  .filter(SslProfileVipsCache.device_id == device_id)
                  .all()
            )

            total_certs = 0
            profiles_seen = set()   # (partition, name)
            links_seen = set()      # (cert_name, fullpath)
            vips_seen = set()       # (fullpath, vip)

            rows_profiles = []
            rows_links = []
            rows_vips = []

            # --- Obtener certificados locales del device ---
            certs_q = db.query(Certificate).filter(Certificate.device_id == device_id).order_by(Certificate.name.asc())
            if limit_certs:
                certs_q = certs_q.limit(int(limit_certs))
            certs: Iterable[Certificate] = certs_q.all()

            if not certs:
                # Run enriched fallback (delta inside)
                result = _fallback_build_from_device(db, dev, password)
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

                # Build map: profile_full_path -> [vip names/dicts]
                vs_by_profile = {}
                for vs in virtual_servers:
                    vs_name = vs.get("name") if isinstance(vs, dict) else str(vs)
                    for pf in (vs.get("profiles", []) or []) if isinstance(vs, dict) else []:
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

                    # Fetch enriched VIPs for this profile to populate destination/port/etc.
                    try:
                        enriched_vips = f5_service_logic.get_ssl_profile_vips(
                            hostname=dev.ip_address,
                            username=dev.username,
                            password=password,
                            profile_fullpath=fullpath,
                        ) or []
                    except Exception:
                        enriched_vips = []

                    # Build lookup by name and fullPath
                    vip_enriched_by_key: dict[str, dict] = {}
                    for ev in enriched_vips:
                        if isinstance(ev, dict):
                            k1 = ev.get("name")
                            k2 = ev.get("fullPath")
                            if k1:
                                vip_enriched_by_key.setdefault(k1, ev)
                            if k2:
                                vip_enriched_by_key.setdefault(k2, ev)

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
                        if isinstance(vip, str):
                            vip_name = vip
                            ev = vip_enriched_by_key.get(vip_name) or vip_enriched_by_key.get(fullpath.rstrip('/') + '/' + vip_name)
                            vip_full_path = (ev.get('fullPath') if isinstance(ev, dict) else None) if ev else None
                            vip_partition = (ev.get('partition') if isinstance(ev, dict) else None) if ev else None
                            dest = (ev.get('destination') if isinstance(ev, dict) else None) if ev else None
                            svc_port = (ev.get('servicePort') if isinstance(ev, dict) else None) if ev else None
                            en = (ev.get('enabled') if isinstance(ev, dict) else None) if ev else None
                            st = (ev.get('status') if isinstance(ev, dict) else None) if ev else None
                        else:
                            vip_name = vip.get("name") or vip.get("fullPath") or vip.get("vip") or "unknown"
                            vip_full_path = vip.get("fullPath")
                            vip_partition = vip.get("partition")
                            dest = vip.get("destination")
                            svc_port = vip.get("servicePort")
                            en = vip.get("enabled")
                            st = vip.get("status")

                        key_v = (fullpath, vip_name)
                        if key_v in vips_seen:
                            continue
                        rows_vips.append({
                            "device_id": device_id,
                            "profile_full_path": fullpath,
                            "vip_name": vip_name,
                            "vip_full_path": vip_full_path,
                            "partition": vip_partition,
                            "destination": dest,
                            "service_port": svc_port,
                            "enabled": en,
                            "status": st,
                            "updated_at": now,
                        })
                        vips_seen.add(key_v)

            # --- UPSERTs (DO UPDATE) ---
            if rows_profiles:
                stmt = pg_insert(SslProfilesCache).values(rows_profiles)
                db.execute(
                    stmt.on_conflict_do_update(
                        index_elements=[SslProfilesCache.device_id, SslProfilesCache.partition, SslProfilesCache.profile_name],
                        set_={"context": stmt.excluded.context, "updated_at": now},
                    )
                )
            if rows_links:
                stmt = pg_insert(CertProfileLinksCache).values(rows_links)
                db.execute(
                    stmt.on_conflict_do_update(
                        index_elements=[CertProfileLinksCache.device_id, CertProfileLinksCache.cert_name, CertProfileLinksCache.profile_full_path],
                        set_={"updated_at": now},
                    )
                )
            if rows_vips:
                stmt = pg_insert(SslProfileVipsCache).values(rows_vips)
                db.execute(
                    stmt.on_conflict_do_update(
                        index_elements=[SslProfileVipsCache.device_id, SslProfileVipsCache.profile_full_path, SslProfileVipsCache.vip_name],
                        set_={
                            "vip_full_path": stmt.excluded.vip_full_path,
                            "partition": stmt.excluded.partition,
                            "destination": stmt.excluded.destination,
                            "service_port": stmt.excluded.service_port,
                            "enabled": stmt.excluded.enabled,
                            "status": stmt.excluded.status,
                            "updated_at": now,
                        },
                    )
                )

            # --- DELETE stale rows ---
            stale_p = existing_profiles - profiles_seen
            stale_l = existing_links - links_seen
            stale_v = existing_vips - vips_seen

            if stale_p:
                db.query(SslProfilesCache).filter(
                    SslProfilesCache.device_id == device_id,
                    tuple_(SslProfilesCache.partition, SslProfilesCache.profile_name).in_(list(stale_p))
                ).delete(synchronize_session=False)
            if stale_l:
                db.query(CertProfileLinksCache).filter(
                    CertProfileLinksCache.device_id == device_id,
                    tuple_(CertProfileLinksCache.cert_name, CertProfileLinksCache.profile_full_path).in_(list(stale_l))
                ).delete(synchronize_session=False)
            if stale_v:
                db.query(SslProfileVipsCache).filter(
                    SslProfileVipsCache.device_id == device_id,
                    tuple_(SslProfileVipsCache.profile_full_path, SslProfileVipsCache.vip_name).in_(list(stale_v))
                ).delete(synchronize_session=False)

            return {
                "status": "success",
                "message": (
                    f"Cache built (delta) for device {dev.hostname}. certs={total_certs}, "
                    f"profiles={len(profiles_seen)}, links={len(links_seen)}, vips={len(vips_seen)}, "
                    f"deleted={len(stale_p) + len(stale_l) + len(stale_v)}"
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
def task_refresh_all_profiles(
    limit_certs: Optional[int] = None,
    include_standby: Optional[bool] = False,
    primaries_only: Optional[bool] = False,
) -> dict:
    """
    Encola un refresh por cada device (para paralelizar).
    Por defecto, solo dispositivos ACTIVE y In Sync. Use include_standby=True para incluir los STANDBY.
    Si primaries_only=True, solo devices con is_primary_preferred=True y active=True.
    """
    db = SessionLocal()
    try:
        q = db.query(Device).filter(Device.active.is_(True))
        if primaries_only:
            q = q.filter(Device.is_primary_preferred.is_(True))
        elif not include_standby:
            q = q.filter(Device.ha_state == "ACTIVE", Device.sync_status.ilike("In Sync%"))
        devices = q.all()
        scheduled = 0
        for d in devices:
            celery_app.send_task(
                "cache.refresh_device_profiles",
                kwargs={"device_id": d.id, "limit_certs": limit_certs}
            )
            scheduled += 1
        return {
            "status": "queued",
            "scheduled": scheduled,
            "include_standby": bool(include_standby),
            "primaries_only": bool(primaries_only),
        }
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