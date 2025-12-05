# ═══════════════════════════════════════════════════════════════════════════════
# ⚠️ DEPRECATED: backend/api/endpoints/f5_cache.py
# ═══════════════════════════════════════════════════════════════════════════════
# 
# This endpoint module is DEPRECATED as of v2.5 (December 2025).
# 
# The cache-based usage detection has been replaced with real-time F5 queries:
# - POST /certificates/batch-usage - Real-time usage state for multiple certs
# - services/f5_service_logic.get_batch_usage_state() - Efficient batch queries
#
# These endpoints are kept for backwards compatibility with existing frontend
# components. They will be removed in v3.0.
#
# DO NOT add new endpoints here. Use certificates.py or f5_scans.py instead.
# ═══════════════════════════════════════════════════════════════════════════════

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session

from db.base import SessionLocal
from db.models import (
    Device,
    SslProfilesCache,
    SslProfileVipsCache,
    CertProfileLinksCache,
)

router = APIRouter(prefix="/f5/cache", tags=["f5-cache (deprecated)"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/impact-preview", deprecated=True, 
           summary="Get certificate impact from cache (DEPRECATED)",
           description="⚠️ **DEPRECATED**: Use `/certificates/{cert_id}/ssl-profiles` for faster, simplified SSL profile lookup.")
def cached_impact_preview(
    device_id: int = Query(...),
    cert_name: str | None = Query(None),
    certName: str | None = Query(None),
    db: Session = Depends(get_db),
):
    # Allow both camelCase and snake_case
    cert_name = cert_name or certName
    if not cert_name:
        raise HTTPException(status_code=400, detail="Missing cert_name")
    dev = db.get(Device, device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    # Traer profiles linkeados al certificado (desde caché)
    links = (
        db.query(CertProfileLinksCache)
          .filter(CertProfileLinksCache.device_id == device_id,
                  CertProfileLinksCache.cert_name == cert_name)
          .all()
    )

    def _normalize_fp(fp: str) -> str:
        fp = (fp or "").strip()
        if not fp:
            return fp
        if not fp.startswith("/"):
            fp = "/" + fp
        while "//" in fp:
            fp = fp.replace("//", "/")
        return fp

    # Si no hay vínculos, responder 200 con impacto cero (permite borrar con seguridad)
    if not links:
        return {
            "device": {
                "id": dev.id,
                "hostname": dev.hostname,
                "ip_address": dev.ip_address,
                "site": dev.site,
            },
            "profiles": [],
            # Campos de resumen para la UI
            "profiles_using_cert": 0,
            "vip_refs": 0,
            "can_delete_safely": True,
            "details": [],
            "error": None,
        }

    fullpaths = [_normalize_fp(l.profile_full_path) for l in links]

    # Resolver info de profile (partition/name/context)
    profiles_rows = (
        db.query(SslProfilesCache)
          .filter(SslProfilesCache.device_id == device_id)
          .all()
    )
    info_by_full = {}
    info_by_full_lc = {}
    for r in profiles_rows:
        key = f"/{r.partition}/{r.profile_name}".replace("//", "/")
        info_by_full[key] = r
        info_by_full_lc[key.lower()] = r

    # Resolver VIPs por profile
    vips_rows = (
        db.query(SslProfileVipsCache)
          .filter(SslProfileVipsCache.device_id == device_id,
                  SslProfileVipsCache.profile_full_path.in_(fullpaths))
          .all()
    )
    vips_map = {}
    vips_map_lc = {}
    for v in vips_rows:
        k = _normalize_fp(v.profile_full_path)
        vips_map.setdefault(k, set()).add(v.vip_name)
        vips_map_lc.setdefault(k.lower(), set()).add(v.vip_name)

    results = []
    details = []
    for fp in fullpaths:
        nfp = _normalize_fp(fp)
        info = info_by_full.get(nfp) or info_by_full_lc.get(nfp.lower())
        vip_set = vips_map.get(nfp) or vips_map_lc.get(nfp.lower()) or set()
        vip_list = sorted(vip_set)
        if info:
            results.append({
                "name": info.profile_name,
                "partition": info.partition or "Common",
                "context": info.context or "—",
                "vips": vip_list,
                "profile_full_path": nfp,
            })
        else:
            parts = nfp.split("/")
            name = parts[2] if len(parts) >= 3 else nfp
            partition = parts[1] if len(parts) >= 3 else "Common"
            results.append({
                "name": name,
                "partition": partition,
                "context": "—",
                "vips": vip_list,
                "profile_full_path": nfp,
            })
        # detalle para UI (hasta 25 elementos se truncarán en frontend si se desea)
        for vip in vip_list:
            details.append({
                "profile": nfp,
                "vip": vip,
            })

    vip_count = sum(len(r.get("vips", [])) for r in results)

    return {
        "device": {
            "id": dev.id,
            "hostname": dev.hostname,
            "ip_address": dev.ip_address,
            "site": dev.site,
        },
        "profiles": results,
        "profiles_using_cert": len(results),
        "vip_refs": vip_count,
        "can_delete_safely": (len(results) == 0 and vip_count == 0),
        "details": details[:25],
        "error": None,
    }


# Alternative RESTful path for impact-preview
@router.get("/impact-preview/device/{device_id}/cert/{cert_name}", deprecated=True,
           summary="Get certificate impact from cache - Alternative path (DEPRECATED)", 
           description="⚠️ **DEPRECATED**: Use `/certificates/{cert_id}/ssl-profiles` for faster, simplified SSL profile lookup.")
def cached_impact_preview_alt(device_id: int, cert_name: str, db: Session = Depends(get_db)):
    return cached_impact_preview(device_id=device_id, cert_name=cert_name, db=db)


@router.post("/refresh", status_code=status.HTTP_202_ACCEPTED, deprecated=True,
            summary="Queue cache refresh (DEPRECATED)",
            description="⚠️ **DEPRECATED**: Cache system being phased out. Direct SSL profile lookup is now preferred.")
def queue_cache_refresh(
    payload: dict | None = Body(None, description='{"device_ids":[...], "include_standby": false} opcional'),
):
    from core.celery_worker import celery_app

    device_ids = (payload or {}).get("device_ids")
    include_standby = bool((payload or {}).get("include_standby", False))

    if device_ids:
        for d in device_ids:
            celery_app.send_task("cache.refresh_device_profiles", kwargs={"device_id": int(d)})
        return {"queued": True, "device_ids": device_ids}

    # Si no viene lista, encola para todos (respetando include_standby)
    res = celery_app.send_task("cache.refresh_all_profiles", kwargs={"include_standby": include_standby})
    return {"queued": True, "task_id": res.id, "include_standby": include_standby}


@router.get("/status")
def cache_status(
    device_id: int = Query(...),
    db: Session = Depends(get_db),
):
    dev = db.get(Device, device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    def _max_dt(q):
        ts = [r.updated_at for r in q]
        return max(ts).isoformat() if ts else None

    prof = db.query(SslProfilesCache).filter(SslProfilesCache.device_id == device_id).all()
    vips = db.query(SslProfileVipsCache).filter(SslProfileVipsCache.device_id == device_id).all()
    links = db.query(CertProfileLinksCache).filter(CertProfileLinksCache.device_id == device_id).all()

    return {
        "device_id": device_id,
        "profiles_count": len(prof),
        "vips_count": len(vips),
        "links_count": len(links),
        "last_updated": _max_dt(prof + vips + links),
    }