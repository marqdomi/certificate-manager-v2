# backend/api/endpoints/f5_scans.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.base import get_db
from db.models import Device
from services.f5_service_tasks import scan_f5_task


router = APIRouter()

@router.post("/scan-all", summary="Trigger a scan for all registered devices")
def trigger_scan_for_all_devices(db: Session = Depends(get_db)):
    """
    Puts a scan task into the Celery queue for each registered device.
    """
    devices = db.query(Device).all()
    if not devices:
        return {"status": "warning", "message": "No devices registered to scan."}

    task_count = 0
    for device in devices:
        # ¡AQUÍ ESTÁ LA MAGIA!
        # En lugar de llamar a la función directamente, usamos .delay()
        # Esto pone la tarea en la cola de Redis para que el worker la recoja.
        scan_f5_task.delay(device.id)
        task_count += 1
        
    return {
        "status": "success",
        "message": f"Successfully queued {task_count} scan tasks."
    }