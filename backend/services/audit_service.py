"""
Audit Service - v2.5

Provides centralized audit logging for all CMT operations.
Designed for compliance and troubleshooting.
"""

import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from db.models import AuditLog, AuditAction, AuditResult, User, Device

logger = logging.getLogger(__name__)


class AuditService:
    """
    Service for creating and querying audit log entries.
    
    Usage:
        audit = AuditService(db)
        audit.log_cert_deployed(
            user=current_user,
            certificate_id=123,
            certificate_name="wildcard.example.com",
            device=device,
            description="Deployed via renewal wizard"
        )
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def _create_entry(
        self,
        action: AuditAction,
        resource_type: str,
        resource_id: Optional[int] = None,
        resource_name: Optional[str] = None,
        user: Optional[User] = None,
        username: Optional[str] = None,
        device: Optional[Device] = None,
        device_id: Optional[int] = None,
        device_hostname: Optional[str] = None,
        result: AuditResult = AuditResult.SUCCESS,
        description: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        """Create an audit log entry."""
        entry = AuditLog(
            timestamp=datetime.utcnow(),
            action=action,
            result=result,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            username=username or (user.username if user else None),
            user_id=user.id if user else None,
            device_id=device_id or (device.id if device else None),
            device_hostname=device_hostname or (device.hostname if device else None),
            description=description,
            details=json.dumps(details) if details else None,
            error_message=error_message,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        
        self.db.add(entry)
        self.db.commit()
        
        # Log to application logger as well
        log_msg = f"AUDIT: {action.value} - {resource_type}"
        if resource_name:
            log_msg += f" '{resource_name}'"
        if device_hostname:
            log_msg += f" on {device_hostname}"
        if result != AuditResult.SUCCESS:
            log_msg += f" [{result.value}]"
        if error_message:
            log_msg += f" - {error_message}"
            
        if result == AuditResult.SUCCESS:
            logger.info(log_msg)
        else:
            logger.warning(log_msg)
        
        return entry
    
    # --------------------------------------------------------------------------
    # Certificate Operations
    # --------------------------------------------------------------------------
    
    def log_cert_deployed(
        self,
        certificate_id: int,
        certificate_name: str,
        device: Optional[Device] = None,
        user: Optional[User] = None,
        description: Optional[str] = None,
        details: Optional[Dict] = None,
        result: AuditResult = AuditResult.SUCCESS,
        error_message: Optional[str] = None,
        **kwargs
    ) -> AuditLog:
        """Log a certificate deployment operation."""
        return self._create_entry(
            action=AuditAction.CERT_DEPLOYED,
            resource_type="certificate",
            resource_id=certificate_id,
            resource_name=certificate_name,
            device=device,
            user=user,
            description=description or f"Certificate '{certificate_name}' deployed",
            details=details,
            result=result,
            error_message=error_message,
            **kwargs
        )
    
    def log_cert_renewed(
        self,
        certificate_id: int,
        certificate_name: str,
        device: Optional[Device] = None,
        user: Optional[User] = None,
        old_expiration: Optional[datetime] = None,
        new_expiration: Optional[datetime] = None,
        **kwargs
    ) -> AuditLog:
        """Log a certificate renewal completion."""
        details = {}
        if old_expiration:
            details["old_expiration"] = old_expiration.isoformat()
        if new_expiration:
            details["new_expiration"] = new_expiration.isoformat()
            
        return self._create_entry(
            action=AuditAction.CERT_RENEWED,
            resource_type="certificate",
            resource_id=certificate_id,
            resource_name=certificate_name,
            device=device,
            user=user,
            description=f"Certificate '{certificate_name}' renewed",
            details=details if details else None,
            **kwargs
        )
    
    def log_cert_deleted(
        self,
        certificate_id: int,
        certificate_name: str,
        device: Optional[Device] = None,
        user: Optional[User] = None,
        **kwargs
    ) -> AuditLog:
        """Log a certificate deletion."""
        return self._create_entry(
            action=AuditAction.CERT_DELETED,
            resource_type="certificate",
            resource_id=certificate_id,
            resource_name=certificate_name,
            device=device,
            user=user,
            description=f"Certificate '{certificate_name}' deleted",
            **kwargs
        )
    
    def log_cert_uploaded(
        self,
        certificate_name: str,
        device: Optional[Device] = None,
        user: Optional[User] = None,
        **kwargs
    ) -> AuditLog:
        """Log a certificate upload."""
        return self._create_entry(
            action=AuditAction.CERT_UPLOADED,
            resource_type="certificate",
            resource_name=certificate_name,
            device=device,
            user=user,
            description=f"Certificate '{certificate_name}' uploaded",
            **kwargs
        )
    
    # --------------------------------------------------------------------------
    # CSR Operations
    # --------------------------------------------------------------------------
    
    def log_csr_generated(
        self,
        request_id: int,
        common_name: str,
        user: Optional[User] = None,
        key_size: int = 2048,
        **kwargs
    ) -> AuditLog:
        """Log CSR generation."""
        return self._create_entry(
            action=AuditAction.CSR_GENERATED,
            resource_type="csr_request",
            resource_id=request_id,
            resource_name=common_name,
            user=user,
            description=f"CSR generated for '{common_name}'",
            details={"key_size": key_size},
            **kwargs
        )
    
    def log_csr_completed(
        self,
        request_id: int,
        common_name: str,
        user: Optional[User] = None,
        pfx_filename: Optional[str] = None,
        **kwargs
    ) -> AuditLog:
        """Log CSR completion with signed certificate."""
        return self._create_entry(
            action=AuditAction.CSR_COMPLETED,
            resource_type="csr_request",
            resource_id=request_id,
            resource_name=common_name,
            user=user,
            description=f"CSR completed for '{common_name}'",
            details={"pfx_filename": pfx_filename} if pfx_filename else None,
            **kwargs
        )
    
    def log_csr_deleted(
        self,
        request_id: int,
        common_name: str,
        user: Optional[User] = None,
        **kwargs
    ) -> AuditLog:
        """Log CSR request deletion."""
        return self._create_entry(
            action=AuditAction.CSR_DELETED,
            resource_type="csr_request",
            resource_id=request_id,
            resource_name=common_name,
            user=user,
            description=f"CSR request for '{common_name}' deleted",
            **kwargs
        )
    
    # --------------------------------------------------------------------------
    # Device Operations
    # --------------------------------------------------------------------------
    
    def log_device_added(
        self,
        device_id: int,
        hostname: str,
        user: Optional[User] = None,
        **kwargs
    ) -> AuditLog:
        """Log device addition to inventory."""
        return self._create_entry(
            action=AuditAction.DEVICE_ADDED,
            resource_type="device",
            resource_id=device_id,
            resource_name=hostname,
            device_id=device_id,
            device_hostname=hostname,
            user=user,
            description=f"Device '{hostname}' added to inventory",
            **kwargs
        )
    
    def log_device_modified(
        self,
        device_id: int,
        hostname: str,
        user: Optional[User] = None,
        changes: Optional[Dict] = None,
        **kwargs
    ) -> AuditLog:
        """Log device modification."""
        return self._create_entry(
            action=AuditAction.DEVICE_MODIFIED,
            resource_type="device",
            resource_id=device_id,
            resource_name=hostname,
            device_id=device_id,
            device_hostname=hostname,
            user=user,
            description=f"Device '{hostname}' modified",
            details={"changes": changes} if changes else None,
            **kwargs
        )
    
    def log_device_deleted(
        self,
        device_id: int,
        hostname: str,
        user: Optional[User] = None,
        **kwargs
    ) -> AuditLog:
        """Log device deletion from inventory."""
        return self._create_entry(
            action=AuditAction.DEVICE_DELETED,
            resource_type="device",
            resource_id=device_id,
            resource_name=hostname,
            user=user,
            description=f"Device '{hostname}' deleted from inventory",
            **kwargs
        )
    
    def log_device_scanned(
        self,
        device_id: int,
        hostname: str,
        certificates_found: int = 0,
        user: Optional[User] = None,
        result: AuditResult = AuditResult.SUCCESS,
        error_message: Optional[str] = None,
        **kwargs
    ) -> AuditLog:
        """Log device certificate scan."""
        return self._create_entry(
            action=AuditAction.DEVICE_SCANNED,
            resource_type="device",
            resource_id=device_id,
            resource_name=hostname,
            device_id=device_id,
            device_hostname=hostname,
            user=user,
            description=f"Scanned device '{hostname}': {certificates_found} certificates",
            details={"certificates_found": certificates_found},
            result=result,
            error_message=error_message,
            **kwargs
        )
    
    # --------------------------------------------------------------------------
    # User Operations
    # --------------------------------------------------------------------------
    
    def log_user_login(
        self,
        username: str,
        user_id: Optional[int] = None,
        result: AuditResult = AuditResult.SUCCESS,
        error_message: Optional[str] = None,
        **kwargs
    ) -> AuditLog:
        """Log user login attempt."""
        return self._create_entry(
            action=AuditAction.USER_LOGIN,
            resource_type="user",
            resource_id=user_id,
            resource_name=username,
            username=username,
            description=f"User '{username}' login {'successful' if result == AuditResult.SUCCESS else 'failed'}",
            result=result,
            error_message=error_message,
            **kwargs
        )
    
    # --------------------------------------------------------------------------
    # Query Methods
    # --------------------------------------------------------------------------
    
    def get_recent_logs(
        self,
        limit: int = 100,
        action: Optional[AuditAction] = None,
        resource_type: Optional[str] = None,
        username: Optional[str] = None,
        device_id: Optional[int] = None,
    ) -> List[AuditLog]:
        """Get recent audit log entries with optional filtering."""
        query = self.db.query(AuditLog)
        
        if action:
            query = query.filter(AuditLog.action == action)
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        if username:
            query = query.filter(AuditLog.username == username)
        if device_id:
            query = query.filter(AuditLog.device_id == device_id)
        
        return query.order_by(desc(AuditLog.timestamp)).limit(limit).all()
    
    def get_logs_for_resource(
        self,
        resource_type: str,
        resource_id: int,
        limit: int = 50
    ) -> List[AuditLog]:
        """Get audit logs for a specific resource."""
        return self.db.query(AuditLog).filter(
            AuditLog.resource_type == resource_type,
            AuditLog.resource_id == resource_id
        ).order_by(desc(AuditLog.timestamp)).limit(limit).all()
    
    def get_logs_for_device(
        self,
        device_id: int,
        limit: int = 100
    ) -> List[AuditLog]:
        """Get audit logs for a specific device."""
        return self.db.query(AuditLog).filter(
            AuditLog.device_id == device_id
        ).order_by(desc(AuditLog.timestamp)).limit(limit).all()


# Convenience function for quick logging without instantiating service
def log_audit(
    db: Session,
    action: AuditAction,
    resource_type: str,
    **kwargs
) -> AuditLog:
    """Quick audit logging function."""
    service = AuditService(db)
    return service._create_entry(action, resource_type, **kwargs)
