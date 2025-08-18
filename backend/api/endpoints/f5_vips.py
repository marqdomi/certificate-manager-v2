

from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any
from services.vips_service import get_vips_grouped

router = APIRouter(prefix="/api/v1/f5", tags=["F5 VIPs"])

@router.get("/vips", summary="List VIPs (from cache) grouped with SSL profiles & certs")
def list_vips(device_id: int = Query(..., description="Device ID (internal DB id)")) -> List[Dict[str, Any]]:
    try:
        return get_vips_grouped(device_id)
    except Exception as e:
        # Surface a nice message but keep 500 status
        raise HTTPException(status_code=500, detail=f"Failed to read VIPs for device {device_id}: {e}")