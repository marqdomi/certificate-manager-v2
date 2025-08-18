from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query
from sqlalchemy import text
from db.base import SessionLocal
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/vips", tags=["VIPs"])

class VipOut(BaseModel):
    device: Dict[str, Any]
    vip_name: str
    destination: Optional[str] = None
    enabled: Optional[bool] = None
    profiles_count: int = 0
    last_updated: Optional[str] = None

def table_exists(conn, name: str) -> bool:
    q = text("SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname='public' AND tablename=:t")
    return conn.execute(q, {"t": name}).first() is not None

@router.get("/search", response_model=List[VipOut])
def search_vips(
    q: Optional[str] = Query(None, description="IP, VIP name or host (ILIKE)"),
    device_id: Optional[int] = Query(None),
    enabled: Optional[bool] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    """
    Busca VIPs por nombre/IP (si existe vips_cache.destination) y opcionalmente por device.
    Si la tabla `vips_cache` no existe, hace fallback a `ssl_profile_vips_cache` (solo nombres).
    """
    s = SessionLocal()
    conn = s.get_bind().connect()
    try:
        has_vips = table_exists(conn, "vips_cache")

        params = {"limit": limit}
        if device_id is not None:
            params["device_id"] = device_id

        if has_vips:
            base = """
              SELECT
                d.id AS device_id,
                d.hostname AS device_hostname,
                vc.vip_name,
                vc.destination,
                vc.enabled,
                GREATEST(COALESCE(vc.last_updated, '1970-01-01'),
                         COALESCE(spvc.last_updated, '1970-01-01')) AS last_updated,
                COUNT(spvc.profile_full_path) AS profiles_count
              FROM vips_cache vc
              JOIN devices d ON d.id = vc.device_id
              LEFT JOIN ssl_profile_vips_cache spvc
                ON spvc.device_id = vc.device_id AND spvc.vip_name = vc.vip_name
            """
            where = []
            if q:
                where.append("(vc.vip_name ILIKE :q OR vc.destination ILIKE :q)")
                params["q"] = f"%{q}%"
            if enabled is not None:
                where.append("vc.enabled = :enabled")
                params["enabled"] = enabled
            if device_id is not None:
                where.append("d.id = :device_id")

            sql = base
            if where:
                sql += " WHERE " + " AND ".join(where)
            sql += " GROUP BY d.id, d.hostname, vc.vip_name, vc.destination, vc.enabled, vc.last_updated, spvc.last_updated"
            sql += " ORDER BY d.hostname, vc.vip_name LIMIT :limit"
        else:
            base = """
              SELECT
                d.id AS device_id,
                d.hostname AS device_hostname,
                spvc.vip_name,
                NULL::text AS destination,
                NULL::boolean AS enabled,
                spvc.last_updated AS last_updated,
                COUNT(spvc.profile_full_path) AS profiles_count
              FROM ssl_profile_vips_cache spvc
              JOIN devices d ON d.id = spvc.device_id
            """
            where = []
            if q:
                where.append("(spvc.vip_name ILIKE :q)")
                params["q"] = f"%{q}%"
            if device_id is not None:
                where.append("d.id = :device_id")

            sql = base
            if where:
                sql += " WHERE " + " AND ".join(where)
            sql += " GROUP BY d.id, d.hostname, spvc.vip_name, spvc.last_updated"
            sql += " ORDER BY d.hostname, spvc.vip_name LIMIT :limit"

        rows = conn.execute(text(sql), params).fetchall()

        result = []
        for r in rows:
            m = r._mapping
            result.append({
                "device": {"id": m["device_id"], "hostname": m["device_hostname"]},
                "vip_name": m["vip_name"],
                "destination": m.get("destination"),
                "enabled": m.get("enabled"),
                "profiles_count": int(m.get("profiles_count", 0)),
                "last_updated": (str(m.get("last_updated")) if m.get("last_updated") else None),
            })
        return result
    finally:
        s.close()