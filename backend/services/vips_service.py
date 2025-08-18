

from sqlalchemy import text
from typing import List, Dict, Any
from db.base import SessionLocal

SQL = text(
    r"""
    SELECT v.vip_name,
           p.partition,
           p.profile_name AS profile_name,
           l.cert_name    AS cert_name,
           v.profile_full_path
    FROM ssl_profile_vips_cache v
    JOIN ssl_profiles_cache p
      ON p.device_id = v.device_id
     AND ('/' || p.partition || '/' || p.profile_name) = v.profile_full_path
    LEFT JOIN cert_profile_links_cache l
      ON l.device_id = v.device_id
     AND l.profile_full_path = v.profile_full_path
    WHERE v.device_id = :device_id
    ORDER BY v.vip_name, p.partition, p.profile_name
    """
)


def get_vips_grouped(device_id: int) -> List[Dict[str, Any]]:
    """Return VIPs grouped with their SSL profiles and linked certs from cache.

    Output:
    [
      {
        "vip_name": "/PARTITION/vs_name",
        "profiles": [
          {
            "full_path": "/PARTITION/profile",
            "partition": "PARTITION",
            "name": "profile",
            "cert_name": "example.crt" | None
          }
        ]
      }
    ]
    """
    with SessionLocal() as s:
        with s.bind.connect() as conn:
            rows = conn.execute(SQL, {"device_id": device_id}).mappings().all()

    # Group rows by VIP
    vips: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        vip = r["vip_name"]
        prof_full = r["profile_full_path"]
        entry = vips.setdefault(vip, {"vip_name": vip, "profiles": []})
        entry["profiles"].append({
            "full_path": prof_full,
            "partition": r["partition"],
            "name": r["profile_name"],
            "cert_name": r.get("cert_name"),
        })

    # Handle VIPs with no profiles (should be rare): read from vips cache alone
    if not vips:
        # Try to at least list distinct vip names from vips cache
        with SessionLocal() as s:
            with s.bind.connect() as conn:
                vip_rows = conn.execute(text(
                    "SELECT DISTINCT vip_name FROM ssl_profile_vips_cache WHERE device_id=:d ORDER BY vip_name"
                ), {"d": device_id}).fetchall()
                for (vip_name,) in vip_rows:
                    vips.setdefault(vip_name, {"vip_name": vip_name, "profiles": []})

    return list(vips.values())