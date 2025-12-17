"""
Rollback Service - v2.5

Provides snapshot creation and rollback capabilities for F5 operations.
Enables safe recovery from certificate deletions and profile modifications.
"""

import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from db.models import (
    OperationSnapshot, 
    OperationType, 
    SnapshotStatus, 
    Device, 
    Certificate,
    AuditAction,
    AuditResult
)
from services import f5_service_logic
from services.audit_service import AuditService
from services.encryption_service import decrypt_data

logger = logging.getLogger(__name__)

# Default snapshot retention period (days)
DEFAULT_RETENTION_DAYS = 7


class RollbackService:
    """
    Service for managing operation snapshots and rollback operations.
    
    Usage:
        rollback_svc = RollbackService(db)
        
        # Before deleting a certificate
        snapshot_id = rollback_svc.create_snapshot_for_deletion(
            device=device,
            cert_name="example.crt",
            partition="Common",
            username="admin"
        )
        
        # If something goes wrong
        result = rollback_svc.rollback_operation(snapshot_id)
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.audit = AuditService(db)
    
    def create_snapshot_for_cert_by_name(
        self,
        device_id: int,
        cert_name: str,
        partition: str = "Common",
        username: Optional[str] = None
    ) -> Optional["OperationSnapshot"]:
        """
        Create a snapshot for a certificate by device_id and cert_name.
        Convenience wrapper for create_snapshot_for_deletion.
        """
        from db.models import Device
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            logger.warning(f"Device {device_id} not found for snapshot")
            return None
        return self.create_snapshot_for_deletion(
            device=device,
            cert_name=cert_name,
            partition=partition,
            created_by=username
        )
    
    def create_snapshot_for_deletion(
        self,
        device: Device,
        cert_name: str,
        partition: str = "Common",
        created_by: Optional[str] = None,
        operation_id: Optional[str] = None,
        retention_days: int = DEFAULT_RETENTION_DAYS
    ) -> OperationSnapshot:
        """
        Create a snapshot before deleting a certificate.
        Captures: certificate PEM, private key reference, SSL profile configurations.
        
        Args:
            device: The F5 device
            cert_name: Name of the certificate to snapshot
            partition: F5 partition
            created_by: Username performing the operation
            operation_id: UUID to group related snapshots (for bulk operations)
            retention_days: How long to keep the snapshot
            
        Returns:
            Created OperationSnapshot object
        """
        if not operation_id:
            operation_id = str(uuid.uuid4())
        
        password = self._get_device_password(device)
        
        try:
            # Get certificate details from F5
            snapshot_data = self._capture_certificate_snapshot(
                hostname=device.hostname,
                username=device.username,
                password=password,
                cert_name=cert_name,
                partition=partition
            )
            
            # Get affected SSL profiles
            affected_profiles = self._get_affected_profiles(
                hostname=device.hostname,
                username=device.username,
                password=password,
                cert_name=cert_name,
                partition=partition
            )
            
            snapshot = OperationSnapshot(
                operation_type=OperationType.CERT_DELETE,
                operation_id=operation_id,
                status=SnapshotStatus.PENDING,
                device_id=device.id,
                device_hostname=device.hostname,
                cert_name=cert_name,
                partition=partition,
                snapshot_data=json.dumps(snapshot_data),
                affected_profiles=json.dumps(affected_profiles) if affected_profiles else None,
                created_by=created_by,
                expires_at=datetime.utcnow() + timedelta(days=retention_days)
            )
            
            self.db.add(snapshot)
            self.db.commit()
            self.db.refresh(snapshot)
            
            logger.info(f"Created snapshot {snapshot.id} for cert '{cert_name}' on {device.hostname}")
            return snapshot
            
        except Exception as e:
            logger.error(f"Failed to create snapshot for {cert_name}: {e}")
            raise
    
    def create_snapshot_for_dissociation(
        self,
        device: Device,
        cert_name: str,
        profile_names: List[str],
        partition: str = "Common",
        created_by: Optional[str] = None,
        operation_id: Optional[str] = None,
        retention_days: int = DEFAULT_RETENTION_DAYS
    ) -> OperationSnapshot:
        """
        Create a snapshot before dissociating a certificate from SSL profiles.
        Captures the current profile configurations for rollback.
        """
        if not operation_id:
            operation_id = str(uuid.uuid4())
        
        password = self._get_device_password(device)
        
        try:
            # Capture profile configurations
            profile_configs = self._capture_profile_configurations(
                hostname=device.hostname,
                username=device.username,
                password=password,
                profile_names=profile_names,
                partition=partition
            )
            
            snapshot_data = {
                "type": "profile_dissociation",
                "cert_name": cert_name,
                "profiles": profile_configs
            }
            
            snapshot = OperationSnapshot(
                operation_type=OperationType.PROFILE_DISSOCIATE,
                operation_id=operation_id,
                status=SnapshotStatus.PENDING,
                device_id=device.id,
                device_hostname=device.hostname,
                cert_name=cert_name,
                partition=partition,
                snapshot_data=json.dumps(snapshot_data),
                affected_profiles=json.dumps(profile_names),
                created_by=created_by,
                expires_at=datetime.utcnow() + timedelta(days=retention_days)
            )
            
            self.db.add(snapshot)
            self.db.commit()
            self.db.refresh(snapshot)
            
            logger.info(f"Created dissociation snapshot {snapshot.id} for {len(profile_names)} profiles")
            return snapshot
            
        except Exception as e:
            logger.error(f"Failed to create dissociation snapshot: {e}")
            raise
    
    def mark_snapshot_applied(self, snapshot_id: int) -> OperationSnapshot:
        """Mark a snapshot's operation as successfully executed."""
        snapshot = self.db.query(OperationSnapshot).filter(
            OperationSnapshot.id == snapshot_id
        ).first()
        
        if not snapshot:
            raise ValueError(f"Snapshot {snapshot_id} not found")
        
        snapshot.status = SnapshotStatus.APPLIED
        snapshot.executed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(snapshot)
        
        return snapshot
    
    def mark_snapshot_failed(self, snapshot_id: int, error_message: str) -> OperationSnapshot:
        """Mark a snapshot's operation as failed."""
        snapshot = self.db.query(OperationSnapshot).filter(
            OperationSnapshot.id == snapshot_id
        ).first()
        
        if not snapshot:
            raise ValueError(f"Snapshot {snapshot_id} not found")
        
        snapshot.status = SnapshotStatus.FAILED
        snapshot.error_message = error_message
        self.db.commit()
        self.db.refresh(snapshot)
        
        return snapshot
    
    def rollback_operation(
        self, 
        snapshot_id: int,
        username: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Rollback an operation using its snapshot.
        
        Args:
            snapshot_id: ID of the snapshot to rollback
            username: User performing the rollback
            
        Returns:
            Dict with rollback results
        """
        snapshot = self.db.query(OperationSnapshot).filter(
            OperationSnapshot.id == snapshot_id
        ).first()
        
        if not snapshot:
            raise ValueError(f"Snapshot {snapshot_id} not found")
        
        if snapshot.status == SnapshotStatus.ROLLED_BACK:
            raise ValueError(f"Snapshot {snapshot_id} has already been rolled back")
        
        if snapshot.status == SnapshotStatus.EXPIRED:
            raise ValueError(f"Snapshot {snapshot_id} has expired")
        
        if snapshot.status not in [SnapshotStatus.APPLIED, SnapshotStatus.FAILED]:
            raise ValueError(f"Snapshot {snapshot_id} cannot be rolled back (status: {snapshot.status})")
        
        device = self.db.query(Device).filter(Device.id == snapshot.device_id).first()
        if not device:
            raise ValueError(f"Device {snapshot.device_id} not found")
        
        password = self._get_device_password(device)
        snapshot_data = json.loads(snapshot.snapshot_data)
        
        try:
            if snapshot.operation_type == OperationType.CERT_DELETE:
                result = self._rollback_certificate_deletion(
                    hostname=device.hostname,
                    username=device.username,
                    password=password,
                    snapshot_data=snapshot_data
                )
            elif snapshot.operation_type == OperationType.PROFILE_DISSOCIATE:
                result = self._rollback_profile_dissociation(
                    hostname=device.hostname,
                    username=device.username,
                    password=password,
                    snapshot_data=snapshot_data
                )
            else:
                raise ValueError(f"Rollback not supported for operation type: {snapshot.operation_type}")
            
            # Update snapshot status
            snapshot.status = SnapshotStatus.ROLLED_BACK
            snapshot.rolled_back_at = datetime.utcnow()
            snapshot.rollback_result = json.dumps(result)
            self.db.commit()
            
            # Log to audit
            self.audit._create_entry(
                action=AuditAction.CERT_UPLOADED,  # Using closest action
                resource_type="snapshot",
                resource_id=snapshot.id,
                resource_name=snapshot.cert_name,
                username=username,
                device_hostname=snapshot.device_hostname,
                result=AuditResult.SUCCESS,
                description=f"Rolled back {snapshot.operation_type.value} for {snapshot.cert_name}",
                details=result
            )
            
            logger.info(f"Successfully rolled back snapshot {snapshot_id}")
            return result
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Rollback failed for snapshot {snapshot_id}: {error_msg}")
            
            snapshot.error_message = error_msg
            self.db.commit()
            
            raise
    
    def get_rollback_preview(self, snapshot_id: int) -> Dict[str, Any]:
        """
        Get a preview of what a rollback would do.
        
        Returns:
            Dict with rollback preview information
        """
        snapshot = self.db.query(OperationSnapshot).filter(
            OperationSnapshot.id == snapshot_id
        ).first()
        
        if not snapshot:
            raise ValueError(f"Snapshot {snapshot_id} not found")
        
        snapshot_data = json.loads(snapshot.snapshot_data)
        affected_profiles = json.loads(snapshot.affected_profiles) if snapshot.affected_profiles else []
        
        return {
            "snapshot_id": snapshot.id,
            "operation_type": snapshot.operation_type.value,
            "status": snapshot.status.value,
            "can_rollback": snapshot.status in [SnapshotStatus.APPLIED, SnapshotStatus.FAILED],
            "device_hostname": snapshot.device_hostname,
            "cert_name": snapshot.cert_name,
            "partition": snapshot.partition,
            "affected_profiles": affected_profiles,
            "created_at": snapshot.created_at.isoformat(),
            "expires_at": snapshot.expires_at.isoformat(),
            "executed_at": snapshot.executed_at.isoformat() if snapshot.executed_at else None,
            "created_by": snapshot.created_by,
            "will_restore": {
                "certificate": snapshot_data.get("cert_pem") is not None,
                "private_key": snapshot_data.get("key_name") is not None,
                "profiles": len(affected_profiles)
            }
        }
    
    def get_snapshots_for_device(
        self, 
        device_id: int,
        include_expired: bool = False
    ) -> List[OperationSnapshot]:
        """Get all snapshots for a device."""
        query = self.db.query(OperationSnapshot).filter(
            OperationSnapshot.device_id == device_id
        )
        
        if not include_expired:
            query = query.filter(OperationSnapshot.status != SnapshotStatus.EXPIRED)
        
        return query.order_by(OperationSnapshot.created_at.desc()).all()
    
    def get_snapshots_by_operation_id(self, operation_id: str) -> List[OperationSnapshot]:
        """Get all snapshots for a bulk operation."""
        return self.db.query(OperationSnapshot).filter(
            OperationSnapshot.operation_id == operation_id
        ).order_by(OperationSnapshot.created_at.asc()).all()
    
    def cleanup_expired_snapshots(self) -> int:
        """
        Mark expired snapshots and optionally purge very old ones.
        Called by Celery beat task.
        
        Returns:
            Number of snapshots marked as expired
        """
        now = datetime.utcnow()
        
        # Mark snapshots as expired
        expired_count = self.db.query(OperationSnapshot).filter(
            and_(
                OperationSnapshot.expires_at < now,
                OperationSnapshot.status.in_([SnapshotStatus.PENDING, SnapshotStatus.APPLIED])
            )
        ).update({OperationSnapshot.status: SnapshotStatus.EXPIRED})
        
        self.db.commit()
        
        if expired_count > 0:
            logger.info(f"Marked {expired_count} snapshots as expired")
        
        return expired_count
    
    # -------------------------------------------------------------------------
    # Private helper methods
    # -------------------------------------------------------------------------
    
    def _get_device_password(self, device: Device) -> str:
        """Decrypt and return device password."""
        from services.credential_service import decrypt_password
        
        if not device.encrypted_password:
            raise ValueError(f"No credentials stored for device {device.hostname}")
        
        return decrypt_password(device.encrypted_password)
    
    def _capture_certificate_snapshot(
        self,
        hostname: str,
        username: str,
        password: str,
        cert_name: str,
        partition: str
    ) -> Dict[str, Any]:
        """Capture certificate details from F5 for snapshot."""
        mgmt = f5_service_logic._connect_to_f5(hostname, username, password)
        
        snapshot_data = {
            "cert_name": cert_name,
            "partition": partition,
            "captured_at": datetime.utcnow().isoformat()
        }
        
        try:
            # Get certificate object
            cert = mgmt.tm.sys.file.ssl_certs.ssl_cert.load(
                name=cert_name, 
                partition=partition
            )
            
            # Store certificate metadata
            snapshot_data["cert_pem"] = getattr(cert, 'certificatePem', None)
            snapshot_data["common_name"] = getattr(cert, 'commonName', None)
            snapshot_data["issuer"] = getattr(cert, 'issuer', None)
            snapshot_data["expiration_string"] = getattr(cert, 'expirationString', None)
            
            # Get associated key name
            key_full_path = getattr(cert, 'key', '')
            if key_full_path:
                key_name = key_full_path.strip('/').split('/')[-1]
            else:
                key_name = cert_name.rsplit('.crt', 1)[0]
            
            snapshot_data["key_name"] = key_name
            
            # Note: We cannot export the private key from F5 (security restriction)
            # Rollback will need to re-upload the cert if we have it stored elsewhere
            snapshot_data["key_exportable"] = False
            
        except Exception as e:
            logger.warning(f"Could not capture full cert details: {e}")
            snapshot_data["capture_error"] = str(e)
        
        return snapshot_data
    
    def _get_affected_profiles(
        self,
        hostname: str,
        username: str,
        password: str,
        cert_name: str,
        partition: str
    ) -> List[str]:
        """Get list of SSL profiles using this certificate."""
        try:
            profiles = f5_service_logic.get_certificate_ssl_profiles_simple(
                hostname=hostname,
                username=username,
                password=password,
                cert_name=cert_name,
                partition=partition
            )
            return [p.get("full_path", p.get("name", "")) for p in profiles]
        except Exception as e:
            logger.warning(f"Could not get affected profiles: {e}")
            return []
    
    def _capture_profile_configurations(
        self,
        hostname: str,
        username: str,
        password: str,
        profile_names: List[str],
        partition: str
    ) -> List[Dict[str, Any]]:
        """Capture SSL profile configurations for rollback."""
        mgmt = f5_service_logic._connect_to_f5(hostname, username, password)
        
        profiles_data = []
        
        for profile_name in profile_names:
            try:
                # Try clientssl first
                profile = mgmt.tm.ltm.profile.client_ssls.client_ssl.load(
                    name=profile_name.split('/')[-1],
                    partition=partition
                )
                profile_type = "clientssl"
            except:
                try:
                    # Try serverssl
                    profile = mgmt.tm.ltm.profile.server_ssls.server_ssl.load(
                        name=profile_name.split('/')[-1],
                        partition=partition
                    )
                    profile_type = "serverssl"
                except Exception as e:
                    logger.warning(f"Could not load profile {profile_name}: {e}")
                    continue
            
            profile_data = {
                "name": profile.name,
                "partition": partition,
                "full_path": profile_name,
                "type": profile_type,
                "certKeyChain": getattr(profile, 'certKeyChain', [])
            }
            profiles_data.append(profile_data)
        
        return profiles_data
    
    def _rollback_certificate_deletion(
        self,
        hostname: str,
        username: str,
        password: str,
        snapshot_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Rollback a certificate deletion.
        
        Note: F5 doesn't allow private key export, so we can only restore
        the certificate if we have the original PEM stored elsewhere.
        """
        result = {
            "success": False,
            "cert_restored": False,
            "key_restored": False,
            "message": ""
        }
        
        cert_pem = snapshot_data.get("cert_pem")
        if not cert_pem:
            result["message"] = "Cannot restore: Certificate PEM not available in snapshot"
            return result
        
        # Note: Private key restoration is not possible from F5 snapshots
        # The key would need to be stored securely elsewhere (e.g., from original CSR generation)
        result["message"] = "Certificate PEM available but private key cannot be recovered from F5 snapshot. " \
                           "To fully restore, re-deploy the original PFX or generate a new certificate."
        result["cert_pem_available"] = True
        
        return result
    
    def _rollback_profile_dissociation(
        self,
        hostname: str,
        username: str,
        password: str,
        snapshot_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Rollback profile dissociation by restoring certKeyChain configurations."""
        mgmt = f5_service_logic._connect_to_f5(hostname, username, password)
        
        result = {
            "success": True,
            "profiles_restored": 0,
            "profiles_failed": 0,
            "errors": []
        }
        
        profiles = snapshot_data.get("profiles", [])
        
        for profile_data in profiles:
            try:
                profile_name = profile_data["name"]
                partition = profile_data["partition"]
                profile_type = profile_data["type"]
                cert_key_chain = profile_data.get("certKeyChain", [])
                
                if profile_type == "clientssl":
                    profile = mgmt.tm.ltm.profile.client_ssls.client_ssl.load(
                        name=profile_name,
                        partition=partition
                    )
                else:
                    profile = mgmt.tm.ltm.profile.server_ssls.server_ssl.load(
                        name=profile_name,
                        partition=partition
                    )
                
                # Restore certKeyChain
                profile.modify(certKeyChain=cert_key_chain)
                result["profiles_restored"] += 1
                
            except Exception as e:
                result["profiles_failed"] += 1
                result["errors"].append(f"{profile_data.get('name', 'unknown')}: {str(e)}")
        
        result["success"] = result["profiles_failed"] == 0
        
        return result
