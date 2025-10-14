from fastapi import APIRouter, Query
from sqlalchemy import text
from db.base import SessionLocal

import re

_RD_DEST_RE = re.compile(r"""
    ^
    (?P<ip>[^%:]+)           # IP (hasta % o :)
    (?:%(?P<rd>\d+))?        # opcional: %route-domain
    (?:\:(?P<port>\d+))?    # opcional: :port
    $
""", re.X)

def _normalize_destination(dest: str | None, service_port: int | None):
    """
    Convierte '10.141.31.51%834:443' -> ('10.141.31.51', 834, 443, '10.141.31.51:443')
    Si no hay puerto en el destino, usa service_port (si viene).
    """
    if not dest:
        # Sin destino: devolver todo None
        return None, None, service_port, (None if service_port is None else f":{service_port}")

    m = _RD_DEST_RE.match(dest.strip())
    if not m:
        # No matchea el patrón; conserva raw y trata de “adivinar” puerto
        ip = dest
        rd = None
        port = service_port
        pretty = f"{ip}:{port}" if (ip and port) else (ip or None)
        return ip, rd, port, pretty

    ip = m.group("ip")
    rd = int(m.group("rd")) if m.group("rd") else None
    port = int(m.group("port")) if m.group("port") else (int(service_port) if service_port else None)
    pretty = f"{ip}:{port}" if (ip and port) else (ip or None)
    return ip, rd, port, pretty

router = APIRouter()

@router.get("/overview")
def vips_overview():
    """
    Resumen por device usando solo columnas existentes:
    - ssl_profile_vips_cache: device_id, profile_full_path, vip_name
    - devices: id, hostname
    """
    s = SessionLocal(); eng = s.get_bind()
    q = """
    SELECT d.id,
           d.hostname,
           COUNT(DISTINCT v.vip_name)          AS vips,
           COUNT(DISTINCT v.profile_full_path) AS profiles,
           MAX(v.updated_at)                   AS last_sync
    FROM devices d
    LEFT JOIN ssl_profile_vips_cache v
           ON v.device_id = d.id
    GROUP BY d.id, d.hostname
    ORDER BY d.hostname
    """
    rows = eng.connect().execute(text(q)).fetchall()
    s.close()
    return [
        {
            "device_id": r[0],
            "hostname": r[1],
            "vips": int(r[2] or 0),
            "profiles": int(r[3] or 0),
            "last_sync": (r[4].isoformat() if r[4] is not None else None)
        }
        for r in rows
    ]

@router.get("/search")
def vips_search(
    q: str | None = Query(None, description="VIP name / host / destination / port"),
    device_id: int | None = Query(None),
    enabled: bool | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    s = SessionLocal(); eng = s.get_bind()

    where = ["1=1"]
    params: dict[str, object] = {"limit": limit}

    if device_id is not None:
        where.append("v.device_id = :device_id")
        params["device_id"] = device_id

    if q and q.strip():
        # patrón para LIKE/ILIKE
        pat = f"%{q.strip().lower()}%"
        params["pat"] = pat
        where.append(
            "("
            "  LOWER(v.vip_name)      LIKE :pat OR "
            "  LOWER(d.hostname)      LIKE :pat OR "
            "  LOWER(COALESCE(v.destination, ''))   LIKE :pat OR "
            "  LOWER(COALESCE(v.vip_full_path, '')) LIKE :pat OR "
            "  LOWER(COALESCE(v.partition, ''))     LIKE :pat OR "
            "  CAST(COALESCE(v.service_port, 0) AS TEXT) LIKE :pat"
            ")"
        )

    sql = f"""
    SELECT
      v.vip_name,
      d.hostname,
      COUNT(DISTINCT v.profile_full_path) AS profiles,
      MAX(v.destination)                  AS destination,
      MAX(v.service_port)                 AS service_port,
      BOOL_OR(COALESCE(v.enabled, false)) AS enabled,
      MAX(v.vip_full_path)                AS vip_full_path,
      MAX(v.partition)                    AS partition,
      MAX(v.status)                       AS status,
      MAX(v.updated_at)                   AS last_sync
    FROM ssl_profile_vips_cache v
    JOIN devices d ON d.id = v.device_id
    WHERE {' AND '.join(where)}
    GROUP BY v.vip_name, d.hostname
    ORDER BY v.vip_name
    LIMIT :limit
    """
    rows = eng.connect().execute(text(sql), params).fetchall()
    s.close()

    result = []
    for r in rows:
        vip_name     = r[0]
        device       = r[1]
        profiles     = int(r[2] or 0)
        destination  = r[3]
        service_port = r[4]
        enabled      = bool(r[5]) if r[5] is not None else None
        vip_full     = r[6]
        partition    = r[7]
        status       = r[8]
        last_sync    = (r[9].isoformat() if r[9] is not None else None)

        ip, rd, port, pretty = _normalize_destination(destination, service_port)

        result.append({
            "vip_name": vip_name,
            "device": device,
            "profiles": profiles,
            "destination": pretty,           # limpio para la GUI
            "destination_raw": destination,  # tal cual viene de F5
            "ip": ip,
            "route_domain": rd,
            "service_port": port,            # consolidado
            "enabled": enabled,
            "vip_full_path": vip_full,
            "partition": partition,
            "status": status,
            "last_sync": last_sync,
        })

    return result