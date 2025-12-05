# backend/services/discovery_tasks.py
"""
Celery tasks for Network Discovery.

These tasks run discovery jobs asynchronously in the background,
allowing the API to return immediately while the scan progresses.
"""

import asyncio
import json
from datetime import datetime
from typing import List, Optional, Dict

from core.celery_worker import celery_app
from core.logger import get_f5_logger
from db.base import SessionLocal
from db.models import (
    Device, 
    DiscoveryJob, 
    DiscoveryJobStatus,
    DiscoveredDevice, 
    DiscoveredDeviceStatus
)
from services.network_discovery import (
    run_discovery, 
    expand_subnets,
    DiscoveryProgress
)
from services.encryption_service import decrypt_data, encrypt_data

logger = get_f5_logger()


def _get_websocket_manager():
    """Lazy import of websocket manager to avoid circular imports."""
    try:
        from api.endpoints.websocket import manager
        return manager
    except ImportError:
        return None


async def _broadcast_progress(progress: DiscoveryProgress):
    """Broadcast discovery progress via WebSocket."""
    manager = _get_websocket_manager()
    if manager:
        await manager.broadcast({
            "type": "discovery_progress",
            "job_id": progress.job_id,
            "total_ips": progress.total_ips,
            "scanned_ips": progress.scanned_ips,
            "found_devices": progress.found_devices,
            "current_ip": progress.current_ip,
            "status": progress.status,
            "percent": round(progress.scanned_ips / max(progress.total_ips, 1) * 100, 1)
        })


@celery_app.task(bind=True, name="discovery.run_discovery_job")
def task_run_discovery_job(
    self, 
    job_id: int, 
    credentials: List[Dict[str, str]] = None,
    save_credentials: bool = False
):
    """
    Run a discovery job asynchronously.
    
    Args:
        job_id: ID of the DiscoveryJob to execute
        credentials: List of credential dicts with 'username', 'password_encrypted', 'name'
        save_credentials: Whether to save credentials for imported devices
    """
    db = SessionLocal()
    
    try:
        # Get the job
        job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
        if not job:
            logger.error(f"Discovery job {job_id} not found")
            return {"success": False, "error": "Job not found"}
        
        # Validate credentials
        if not credentials or len(credentials) == 0:
            job.status = DiscoveryJobStatus.FAILED
            job.error_message = "No credentials provided for discovery"
            db.commit()
            return {"success": False, "error": "No credentials provided"}
        
        # Decrypt credentials for use
        decrypted_credentials = []
        for cred in credentials:
            try:
                password = decrypt_data(cred["password_encrypted"])
                decrypted_credentials.append((
                    cred["username"],
                    password,
                    cred.get("name", cred["username"])
                ))
            except Exception as e:
                logger.error(f"Failed to decrypt credential: {e}")
        
        if not decrypted_credentials:
            job.status = DiscoveryJobStatus.FAILED
            job.error_message = "Failed to decrypt credentials"
            db.commit()
            return {"success": False, "error": "Failed to decrypt credentials"}
        
        logger.info(f"Using {len(decrypted_credentials)} credential set(s) for discovery job {job_id}")
        
        # Update status to running
        job.status = DiscoveryJobStatus.RUNNING
        job.started_at = datetime.utcnow()
        db.commit()
        
        # Parse subnets
        subnets = json.loads(job.subnets)
        all_ips = expand_subnets(subnets)
        job.total_ips = len(all_ips)
        db.commit()
        
        logger.info(f"Starting discovery job {job_id}: {len(all_ips)} IPs to scan")
        
        # Progress callback that updates DB and broadcasts
        async def progress_callback(progress: DiscoveryProgress):
            nonlocal job
            progress.job_id = job_id
            
            # Update job progress in DB
            job.scanned_ips = progress.scanned_ips
            job.found_devices = progress.found_devices
            db.commit()
            
            # Broadcast via WebSocket
            await _broadcast_progress(progress)
        
        # Run discovery (async) with user-provided credentials
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            results = loop.run_until_complete(
                run_discovery(
                    subnets, 
                    credentials=decrypted_credentials,
                    max_concurrent=100, 
                    progress_callback=progress_callback
                )
            )
        finally:
            loop.close()
        
        # Store the encrypted credentials for use during import (if save_credentials is True)
        encrypted_creds_for_import = credentials if save_credentials else None
        
        # Check for duplicates and save discovered devices
        existing_ips = {d.ip_address for d in db.query(Device.ip_address).all()}
        existing_hostnames = {d.hostname for d in db.query(Device.hostname).all() if d.hostname}
        
        for result in results:
            status = DiscoveredDeviceStatus.PENDING
            
            # Check for duplicates
            if result.ip_address in existing_ips:
                status = DiscoveredDeviceStatus.DUPLICATE
            elif result.hostname and result.hostname in existing_hostnames:
                status = DiscoveredDeviceStatus.DUPLICATE
            
            discovered = DiscoveredDevice(
                job_id=job_id,
                ip_address=result.ip_address,
                hostname=result.hostname,
                version=result.version,
                platform=result.platform or "BIG-IP",
                serial_number=result.serial_number,
                ha_state=result.ha_state,
                status=status,
                probe_success=result.is_f5,
                probe_message=result.error_message,
                credential_source=result.credential_source,
                suggested_site=result.suggested_site,
                suggested_cluster_key=result.suggested_cluster_key
            )
            db.add(discovered)
        
        # Update job as completed
        job.status = DiscoveryJobStatus.COMPLETED
        job.completed_at = datetime.utcnow()
        job.found_devices = len(results)
        db.commit()
        
        logger.info(f"Discovery job {job_id} completed: found {len(results)} devices")
        
        # Final WebSocket broadcast
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_broadcast_progress(DiscoveryProgress(
                job_id=job_id,
                total_ips=job.total_ips,
                scanned_ips=job.total_ips,
                found_devices=len(results),
                status="completed"
            )))
        finally:
            loop.close()
        
        return {
            "success": True,
            "job_id": job_id,
            "total_ips": job.total_ips,
            "found_devices": len(results)
        }
        
    except Exception as e:
        logger.error(f"Discovery job {job_id} failed: {e}")
        
        # Update job as failed
        job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
        if job:
            job.status = DiscoveryJobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()
        
        return {"success": False, "error": str(e)}
        
    finally:
        db.close()


@celery_app.task(name="discovery.import_discovered_devices")
def task_import_discovered_devices(job_id: int, device_ids: Optional[List[int]] = None, auto_cluster: bool = True):
    """
    Import discovered devices into the main inventory.
    
    Args:
        job_id: Discovery job ID
        device_ids: Specific discovered device IDs to import (None = all pending)
        auto_cluster: Whether to auto-assign clusters after import
    """
    db = SessionLocal()
    
    try:
        # Get discovered devices to import
        query = db.query(DiscoveredDevice).filter(
            DiscoveredDevice.job_id == job_id,
            DiscoveredDevice.status == DiscoveredDeviceStatus.PENDING,
            DiscoveredDevice.probe_success == True
        )
        
        if device_ids:
            query = query.filter(DiscoveredDevice.id.in_(device_ids))
        
        discovered_devices = query.all()
        
        imported_count = 0
        skipped_count = 0
        
        for dd in discovered_devices:
            # Double-check for duplicates
            existing = db.query(Device).filter(
                (Device.ip_address == dd.ip_address) | 
                (Device.hostname == dd.hostname)
            ).first()
            
            if existing:
                dd.status = DiscoveredDeviceStatus.DUPLICATE
                skipped_count += 1
                continue
            
            # Create new device
            new_device = Device(
                hostname=dd.hostname or dd.ip_address,
                ip_address=dd.ip_address,
                site=dd.suggested_site,
                version=dd.version,
                platform=dd.platform,
                serial_number=dd.serial_number,
                ha_state=dd.ha_state,
                cluster_key=dd.suggested_cluster_key,
                username="admin",  # Default, will need credentials set
                active=True
            )
            db.add(new_device)
            db.flush()  # Get the ID
            
            # Update discovered device status
            dd.status = DiscoveredDeviceStatus.IMPORTED
            dd.imported_device_id = new_device.id
            
            imported_count += 1
        
        db.commit()
        
        logger.info(f"Imported {imported_count} devices from job {job_id} ({skipped_count} skipped)")
        
        # Auto-assign clusters if requested
        if auto_cluster and imported_count > 0:
            _auto_assign_clusters(db)
        
        # Broadcast update via WebSocket
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            manager = _get_websocket_manager()
            if manager:
                loop.run_until_complete(manager.broadcast({
                    "type": "discovery_import_complete",
                    "job_id": job_id,
                    "imported": imported_count,
                    "skipped": skipped_count
                }))
        finally:
            loop.close()
        
        return {
            "success": True,
            "imported": imported_count,
            "skipped": skipped_count
        }
        
    except Exception as e:
        logger.error(f"Import failed for job {job_id}: {e}")
        db.rollback()
        return {"success": False, "error": str(e)}
        
    finally:
        db.close()


def _auto_assign_clusters(db):
    """
    Auto-assign cluster_key and is_primary_preferred based on hostname patterns.
    
    This is the same logic as the /devices/cluster/auto-assign endpoint.
    """
    import re
    
    devices = db.query(Device).all()
    cluster_map = {}
    
    # Pattern to normalize hostnames
    regex = re.compile(r"(-LB0?\d+-(PRI|SEC|PRIMARY|SECONDARY))$", re.IGNORECASE)
    
    for dev in devices:
        # Derive cluster_key from hostname
        if not dev.cluster_key:
            base = regex.sub("", dev.hostname)
            dev.cluster_key = base
        
        key = dev.cluster_key
        if key not in cluster_map:
            cluster_map[key] = []
        cluster_map[key].append(dev)
    
    # Assign is_primary_preferred per cluster
    for cluster, devs in cluster_map.items():
        primary = None
        for d in devs:
            if (d.ha_state or "").upper() == "ACTIVE" and \
               (d.sync_status or "").lower().startswith("in sync"):
                primary = d
                break
        
        for d in devs:
            d.is_primary_preferred = False
        
        if primary:
            primary.is_primary_preferred = True
    
    db.commit()
    logger.info(f"Auto-assigned clusters for {len(cluster_map)} cluster groups")
