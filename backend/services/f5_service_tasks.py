# backend/services/f5_service_tasks.py
from datetime import datetime

from db.base import SessionLocal
from db.models import Device
from services import f5_service_logic, encryption_service
from core.celery_worker import celery_app

# This function can be called by Celery via a wrapper in core.celery_worker.py
def scan_f5_impl(device_id: int):
    db = SessionLocal()
    # 1. Obtenemos el objeto 'device' de la BBDD
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        print(f"ERROR: [Task] Device with ID {device_id} not found in DB.")
        db.close()
        return
    # 2. Extraemos TODA la información que necesitamos ANTES de entrar al bloque principal
    device_hostname = device.hostname
    device_ip = device.ip_address
    encrypted_pass = device.encrypted_password
    username = device.username
    # 3. Inicializamos las variables de resultado
    final_status = 'failed'
    final_message = 'Task did not run to completion.'
    try:
        if not encrypted_pass:
            raise ValueError("No credentials configured for this device.")
        password = encryption_service.decrypt_data(encrypted_pass)
        # 4. Llamamos a la lógica de escaneo
        result = f5_service_logic._perform_scan(db, device, username, password)
        # 5. Guardamos el resultado en nuestras variables locales
        final_status = result.get('status', 'failed')
        final_message = result.get('message', 'Scan finished with no details.')
    except Exception as e:
        final_status = 'failed'
        final_message = str(e)
        print(f"ERROR: [Task] Pre-scan check failed for {device_hostname}. Reason: {final_message}")
    # 6. Actualizamos la BBDD fuera del 'try...except' principal de la lógica de negocio
    #    pero ANTES de cerrar la sesión.
    device.last_scan_status = final_status
    device.last_scan_message = final_message
    device.last_scan_timestamp = datetime.utcnow()
    db.commit()
    print(f"INFO: [Task] Finalized scan for {device_hostname} with status: {final_status}")
    db.close()
    return {"device_id": device_id, "status": final_status, "message": final_message}

# backward-compat alias for API imports
scan_f5_task = scan_f5_impl  # backward-compat alias for API imports


def trigger_scan_for_all_devices_impl():
    """
    Tarea que Celery Beat llamará. Pone en cola un escaneo para cada dispositivo.
    """
    db = SessionLocal()
    try:
        devices = db.query(Device).all()
        if not devices:
            print("INFO: [Celery Beat] No devices to scan.")
            return "No devices registered."
        for device in devices:
            celery_app.send_task("scan_single_f5", args=[device.id])
        message = f"Successfully queued {len(devices)} scan tasks from scheduled job."
        print(f"INFO: [Celery Beat] {message}")
        return message
    finally:
        db.close()



# Leave these as plain helpers for core.celery_worker to register
def normalize_object_names_task(device_id: int):
    db = SessionLocal()
    try:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device or not device.encrypted_password:
            return {"status": "error", "message": "Device not found or credentials not set."}
        report = f5_service_logic.normalize_object_names(
            hostname=device.ip_address,
            username=device.username,
            password=encryption_service.decrypt_data(device.encrypted_password),
        )
        return {"status": "success", "report": report}
    finally:
        db.close()

def refresh_device_facts_task(device_id: int):
    from services.f5_facts import fetch_and_store_device_facts
    return fetch_and_store_device_facts(device_id)

def refresh_device_facts_all_task():
    db = SessionLocal()
    try:
        ids = [d.id for d in db.query(Device.id).all()]
        for did in ids:
            celery_app.send_task("devices.refresh_facts", args=[did])
        return {"status":"queued","count":len(ids)}
    finally:
        db.close()