# backend/services/notification_service.py
"""
Notification Service for CMT Enterprise.

Handles:
- Creating and storing notifications in database
- Broadcasting notifications via WebSocket
- Notification preferences filtering
- Scheduled notification cleanup
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from db.models import (
    Notification, NotificationType, NotificationPriority,
    User, UserPreferences
)
from core.logger import setup_logger

logger = setup_logger("cmt.notifications")


class NotificationService:
    """
    Service for managing notifications across the CMT application.
    Provides both database persistence and real-time delivery.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    async def create_notification(
        self,
        notification_type: NotificationType,
        title: str,
        message: str,
        user_id: Optional[int] = None,  # None for broadcast
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        data: Optional[Dict[str, Any]] = None,
        action_url: Optional[str] = None,
        action_label: Optional[str] = None,
        expires_in_days: Optional[int] = 30,
        broadcast_ws: bool = True
    ) -> Notification:
        """
        Create a new notification and optionally broadcast via WebSocket.
        
        Args:
            notification_type: Type of notification (from NotificationType enum)
            title: Short title for the notification
            message: Full notification message
            user_id: Target user ID, or None for broadcast to all
            priority: Notification priority level
            data: Additional JSON data (e.g., certificate ID, device ID)
            action_url: URL to navigate to when clicked
            action_label: Button label (e.g., "View Certificate")
            expires_in_days: Auto-delete after this many days (None = never)
            broadcast_ws: Whether to send via WebSocket immediately
        
        Returns:
            Created Notification object
        """
        # Check user preferences if targeted notification
        if user_id:
            should_notify = await self._check_user_preferences(user_id, notification_type)
            if not should_notify:
                logger.debug(f"Notification {notification_type.value} suppressed for user {user_id} by preferences")
                return None
        
        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
        # Create notification record
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            priority=priority,
            title=title,
            message=message,
            data=json.dumps(data) if data else None,
            action_url=action_url,
            action_label=action_label,
            expires_at=expires_at
        )
        
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        
        logger.info(f"Created notification: {notification_type.value} for user_id={user_id or 'broadcast'}")
        
        # Broadcast via WebSocket if requested
        if broadcast_ws:
            await self._broadcast_notification(notification, user_id)
        
        return notification
    
    async def _check_user_preferences(self, user_id: int, notification_type: NotificationType) -> bool:
        """Check if user has enabled this notification type in preferences."""
        prefs = self.db.query(UserPreferences).filter(
            UserPreferences.user_id == user_id
        ).first()
        
        if not prefs or not prefs.notification_settings:
            return True  # Default to enabled
        
        try:
            settings = json.loads(prefs.notification_settings)
            # If the type is explicitly disabled, return False
            return settings.get(notification_type.value, True)
        except json.JSONDecodeError:
            return True
    
    async def _broadcast_notification(self, notification: Notification, user_id: Optional[int]):
        """Broadcast notification via WebSocket."""
        try:
            # Import here to avoid circular imports
            from api.endpoints.websocket import manager
            
            ws_message = {
                "type": "notification",
                "payload": {
                    "id": notification.id,
                    "notification_type": notification.type.value,
                    "priority": notification.priority.value,
                    "title": notification.title,
                    "message": notification.message,
                    "data": json.loads(notification.data) if notification.data else None,
                    "action_url": notification.action_url,
                    "action_label": notification.action_label,
                    "created_at": notification.created_at.isoformat()
                },
                "target_user_id": user_id  # None means broadcast to all
            }
            
            await manager.broadcast(ws_message)
            
        except Exception as e:
            logger.warning(f"Failed to broadcast notification via WebSocket: {e}")
    
    async def create_bulk_notifications(
        self,
        notification_type: NotificationType,
        title: str,
        message: str,
        user_ids: List[int],
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        data: Optional[Dict[str, Any]] = None,
        action_url: Optional[str] = None,
        action_label: Optional[str] = None
    ) -> List[Notification]:
        """
        Create notifications for multiple specific users.
        
        Args:
            user_ids: List of user IDs to notify
        
        Returns:
            List of created Notification objects
        """
        notifications = []
        
        for user_id in user_ids:
            notification = await self.create_notification(
                notification_type=notification_type,
                title=title,
                message=message,
                user_id=user_id,
                priority=priority,
                data=data,
                action_url=action_url,
                action_label=action_label,
                broadcast_ws=False  # We'll do one bulk broadcast
            )
            if notification:
                notifications.append(notification)
        
        # Single WebSocket broadcast for all targeted users
        if notifications:
            try:
                from api.endpoints.websocket import manager
                
                ws_message = {
                    "type": "notification_bulk",
                    "payload": {
                        "notification_type": notification_type.value,
                        "title": title,
                        "count": len(notifications)
                    },
                    "target_user_ids": user_ids
                }
                await manager.broadcast(ws_message)
            except Exception as e:
                logger.warning(f"Failed to broadcast bulk notification: {e}")
        
        return notifications
    
    def cleanup_expired_notifications(self) -> int:
        """
        Delete expired notifications.
        Should be called periodically (e.g., by Celery beat).
        
        Returns:
            Number of deleted notifications
        """
        result = self.db.query(Notification).filter(
            Notification.expires_at.isnot(None),
            Notification.expires_at < datetime.utcnow()
        ).delete(synchronize_session=False)
        
        self.db.commit()
        
        if result > 0:
            logger.info(f"Cleaned up {result} expired notifications")
        
        return result


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTIONS FOR COMMON NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

async def notify_cert_expiring(
    db: Session,
    cert_name: str,
    device_hostname: str,
    expiration_date: datetime,
    days_until_expiry: int,
    cert_id: int,
    user_id: Optional[int] = None
):
    """Send notification about expiring certificate."""
    service = NotificationService(db)
    
    # Determine priority based on days until expiry
    if days_until_expiry <= 7:
        priority = NotificationPriority.CRITICAL
    elif days_until_expiry <= 14:
        priority = NotificationPriority.HIGH
    elif days_until_expiry <= 30:
        priority = NotificationPriority.MEDIUM
    else:
        priority = NotificationPriority.LOW
    
    await service.create_notification(
        notification_type=NotificationType.CERT_EXPIRING_SOON,
        title=f"Certificate Expiring in {days_until_expiry} days",
        message=f"Certificate '{cert_name}' on {device_hostname} expires on {expiration_date.strftime('%Y-%m-%d')}",
        user_id=user_id,
        priority=priority,
        data={
            "certificate_id": cert_id,
            "certificate_name": cert_name,
            "device_hostname": device_hostname,
            "expiration_date": expiration_date.isoformat(),
            "days_until_expiry": days_until_expiry
        },
        action_url=f"/certificates?highlight={cert_id}",
        action_label="View Certificate"
    )


async def notify_cert_deployed(
    db: Session,
    cert_name: str,
    device_hostname: str,
    cert_id: int,
    user_id: Optional[int] = None
):
    """Send notification about successful certificate deployment."""
    service = NotificationService(db)
    
    await service.create_notification(
        notification_type=NotificationType.CERT_DEPLOYED,
        title="Certificate Deployed Successfully",
        message=f"Certificate '{cert_name}' has been deployed to {device_hostname}",
        user_id=user_id,
        priority=NotificationPriority.MEDIUM,
        data={
            "certificate_id": cert_id,
            "certificate_name": cert_name,
            "device_hostname": device_hostname
        },
        action_url=f"/certificates?highlight={cert_id}",
        action_label="View Certificate"
    )


async def notify_cert_deploy_failed(
    db: Session,
    cert_name: str,
    device_hostname: str,
    error_message: str,
    cert_id: int,
    user_id: Optional[int] = None
):
    """Send notification about failed certificate deployment."""
    service = NotificationService(db)
    
    await service.create_notification(
        notification_type=NotificationType.CERT_DEPLOY_FAILED,
        title="Certificate Deployment Failed",
        message=f"Failed to deploy '{cert_name}' to {device_hostname}: {error_message}",
        user_id=user_id,
        priority=NotificationPriority.HIGH,
        data={
            "certificate_id": cert_id,
            "certificate_name": cert_name,
            "device_hostname": device_hostname,
            "error": error_message
        },
        action_url=f"/certificates?highlight={cert_id}",
        action_label="View Details"
    )


async def notify_batch_renewal_complete(
    db: Session,
    total_certs: int,
    successful: int,
    failed: int,
    user_id: Optional[int] = None
):
    """Send notification about batch renewal completion."""
    service = NotificationService(db)
    
    if failed == 0:
        notification_type = NotificationType.BATCH_RENEWAL_COMPLETE
        title = "Batch Renewal Completed Successfully"
        priority = NotificationPriority.MEDIUM
    elif successful == 0:
        notification_type = NotificationType.BATCH_RENEWAL_FAILED
        title = "Batch Renewal Failed"
        priority = NotificationPriority.HIGH
    else:
        notification_type = NotificationType.BATCH_RENEWAL_PARTIAL
        title = "Batch Renewal Partially Completed"
        priority = NotificationPriority.HIGH
    
    await service.create_notification(
        notification_type=notification_type,
        title=title,
        message=f"Processed {total_certs} certificates: {successful} succeeded, {failed} failed",
        user_id=user_id,
        priority=priority,
        data={
            "total": total_certs,
            "successful": successful,
            "failed": failed
        },
        action_url="/batch-renewal",
        action_label="View Results"
    )


async def notify_discovery_complete(
    db: Session,
    job_id: int,
    total_ips: int,
    found_devices: int,
    user_id: Optional[int] = None
):
    """Send notification about discovery job completion."""
    service = NotificationService(db)
    
    await service.create_notification(
        notification_type=NotificationType.DISCOVERY_COMPLETE,
        title="Network Discovery Completed",
        message=f"Scanned {total_ips} IPs, found {found_devices} new devices",
        user_id=user_id,
        priority=NotificationPriority.MEDIUM,
        data={
            "job_id": job_id,
            "total_ips": total_ips,
            "found_devices": found_devices
        },
        action_url=f"/discovery/jobs/{job_id}",
        action_label="View Results"
    )


async def notify_device_unreachable(
    db: Session,
    device_hostname: str,
    device_id: int,
    error_message: str,
    user_id: Optional[int] = None
):
    """Send notification about unreachable device."""
    service = NotificationService(db)
    
    await service.create_notification(
        notification_type=NotificationType.DEVICE_UNREACHABLE,
        title="Device Unreachable",
        message=f"Cannot connect to {device_hostname}: {error_message}",
        user_id=user_id,
        priority=NotificationPriority.HIGH,
        data={
            "device_id": device_id,
            "device_hostname": device_hostname,
            "error": error_message
        },
        action_url=f"/devices?highlight={device_id}",
        action_label="View Device"
    )


async def notify_system_alert(
    db: Session,
    title: str,
    message: str,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
    data: Optional[Dict[str, Any]] = None
):
    """Send system-wide broadcast notification."""
    service = NotificationService(db)
    
    await service.create_notification(
        notification_type=NotificationType.SYSTEM_ALERT,
        title=title,
        message=message,
        user_id=None,  # Broadcast to all
        priority=priority,
        data=data
    )


async def notify_user_created(
    db: Session,
    new_username: str,
    new_user_id: int,
    created_by: str,
    admin_user_ids: List[int]
):
    """Notify admins about new user creation."""
    service = NotificationService(db)
    
    await service.create_bulk_notifications(
        notification_type=NotificationType.USER_CREATED,
        title="New User Created",
        message=f"User '{new_username}' was created by {created_by}",
        user_ids=admin_user_ids,
        priority=NotificationPriority.LOW,
        data={
            "new_user_id": new_user_id,
            "new_username": new_username,
            "created_by": created_by
        },
        action_url=f"/admin/users/{new_user_id}",
        action_label="View User"
    )
