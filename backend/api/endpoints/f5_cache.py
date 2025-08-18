# backend/api/endpoints/f5_cache.py
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

router = APIRouter(prefix="/f5/cache", tags=["f5-cache"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/impact-preview")
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

    # Traer profiles linkeados al certificado
    links = (
        db.query(CertProfileLinksCache)
          .filter(CertProfileLinksCache.device_id == device_id,
                  CertProfileLinksCache.cert_name == cert_name)
          .all()
    )
    if not links:
        # 404 para que el frontend muestre “no cache” y, si quiere, caiga al live o al endpoint legacy
        raise HTTPException(status_code=404, detail="No cached data for this cert/device")

    def _normalize_fp(fp: str) -> str:
        fp = (fp or "").strip()
        if not fp:
            return fp
        if not fp.startswith("/"):
            fp = "/" + fp
        # collapse multiple slashes
        while "//" in fp:
            fp = fp.replace("//", "/")
        return fp
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
        key = f"/{r.partition}/{r.profile_name}"
        key = key.replace("//", "/")
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

    return {
        "device": {
            "id": dev.id,
            "hostname": dev.hostname,
            "ip_address": dev.ip_address,
            "site": dev.site,
        },
        "profiles": results,
        "error": None,
    }


# Alternative RESTful path for impact-preview
@router.get("/impact-preview/device/{device_id}/cert/{cert_name}")
def cached_impact_preview_alt(device_id: int, cert_name: str, db: Session = Depends(get_db)):
    return cached_impact_preview(device_id=device_id, cert_name=cert_name, db=db)


@router.post("/refresh", status_code=status.HTTP_202_ACCEPTED)
def queue_cache_refresh(
    payload: dict | None = Body(None, description='{"device_ids":[...]} opcional'),
):
    from core.celery_worker import celery_app

    device_ids = (payload or {}).get("device_ids")
    if device_ids:
        for d in device_ids:
            celery_app.send_task("cache.refresh_device_profiles", kwargs={"device_id": int(d)})
        return {"queued": True, "device_ids": device_ids}

    # Si no viene lista, encola para todos
    res = celery_app.send_task("cache.refresh_all_profiles", kwargs={})
    return {"queued": True, "task_id": res.id}


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