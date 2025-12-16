# backend/api/endpoints/notifications.py
"""
Notification API endpoints for CMT Enterprise Admin Panel.
Provides notification management including list, mark read, and preferences.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Annotated, List, Optional
from datetime import datetime
import json

from db.base import get_db
from db.models import User, Notification, NotificationType, NotificationPriority, UserPreferences
from services import auth_service
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class NotificationResponse(BaseModel):
    """Schema for notification response."""
    id: int
    type: NotificationType
    priority: NotificationPriority
    title: str
    message: str
    data: Optional[dict] = None
    action_url: Optional[str] = None
    action_label: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    @classmethod
    def from_orm_with_data(cls, notification: Notification):
        """Convert notification with JSON data parsing."""
        data_dict = None
        if notification.data:
            try:
                data_dict = json.loads(notification.data)
            except json.JSONDecodeError:
                data_dict = None
        
        return cls(
            id=notification.id,
            type=notification.type,
            priority=notification.priority,
            title=notification.title,
            message=notification.message,
            data=data_dict,
            action_url=notification.action_url,
            action_label=notification.action_label,
            is_read=notification.is_read,
            read_at=notification.read_at,
            created_at=notification.created_at,
            expires_at=notification.expires_at
        )


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list response."""
    items: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int
    total_pages: int


class UnreadCountResponse(BaseModel):
    """Schema for unread count response."""
    unread_count: int
    critical_count: int
    high_count: int


class MarkReadRequest(BaseModel):
    """Schema for marking notifications as read."""
    notification_ids: List[int] = Field(..., min_length=1, description="List of notification IDs to mark as read")


class NotificationPreferencesResponse(BaseModel):
    """Schema for notification preferences."""
    notification_settings: dict
    email_notifications_enabled: bool
    email_digest_frequency: str

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferencesUpdate(BaseModel):
    """Schema for updating notification preferences."""
    notification_settings: Optional[dict] = None
    email_notifications_enabled: Optional[bool] = None
    email_digest_frequency: Optional[str] = Field(None, pattern="^(realtime|daily|weekly|never)$")


class CreateNotificationRequest(BaseModel):
    """Schema for admin creating a notification (broadcast or targeted)."""
    user_id: Optional[int] = Field(None, description="Target user ID (null for broadcast)")
    type: NotificationType = Field(default=NotificationType.SYSTEM_ALERT)
    priority: NotificationPriority = Field(default=NotificationPriority.MEDIUM)
    title: str = Field(..., max_length=255)
    message: str
    data: Optional[dict] = None
    action_url: Optional[str] = None
    action_label: Optional[str] = None
    expires_at: Optional[datetime] = None


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=NotificationListResponse, summary="List notifications")
async def list_notifications(
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)],
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    unread_only: bool = Query(False, description="Show only unread notifications"),
    priority: Optional[NotificationPriority] = Query(None, description="Filter by priority"),
    notification_type: Optional[NotificationType] = Query(None, alias="type", description="Filter by type")
):
    """
    List notifications for the current user.
    Includes both personal notifications and broadcasts.
    """
    # Query for user's notifications OR broadcasts (user_id is NULL)
    query = db.query(Notification).filter(
        or_(
            Notification.user_id == current_user.id,
            Notification.user_id.is_(None)  # Broadcasts
        )
    )
    
    # Filter out expired notifications
    query = query.filter(
        or_(
            Notification.expires_at.is_(None),
            Notification.expires_at > datetime.utcnow()
        )
    )
    
    # Apply filters
    if unread_only:
        query = query.filter(Notification.is_read == False)
    if priority:
        query = query.filter(Notification.priority == priority)
    if notification_type:
        query = query.filter(Notification.type == notification_type)
    
    # Get total count
    total = query.count()
    
    # Get unread count (for the badge)
    unread_query = db.query(Notification).filter(
        or_(
            Notification.user_id == current_user.id,
            Notification.user_id.is_(None)
        ),
        Notification.is_read == False,
        or_(
            Notification.expires_at.is_(None),
            Notification.expires_at > datetime.utcnow()
        )
    )
    unread_count = unread_query.count()
    
    # Apply pagination (newest first)
    offset = (page - 1) * page_size
    notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return NotificationListResponse(
        items=[NotificationResponse.from_orm_with_data(n) for n in notifications],
        total=total,
        unread_count=unread_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/unread-count", response_model=UnreadCountResponse, summary="Get unread notification count")
async def get_unread_count(
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Get the count of unread notifications (for notification badge).
    Fast endpoint for polling.
    """
    base_filter = and_(
        or_(
            Notification.user_id == current_user.id,
            Notification.user_id.is_(None)
        ),
        Notification.is_read == False,
        or_(
            Notification.expires_at.is_(None),
            Notification.expires_at > datetime.utcnow()
        )
    )
    
    unread_count = db.query(Notification).filter(base_filter).count()
    
    critical_count = db.query(Notification).filter(
        base_filter,
        Notification.priority == NotificationPriority.CRITICAL
    ).count()
    
    high_count = db.query(Notification).filter(
        base_filter,
        Notification.priority == NotificationPriority.HIGH
    ).count()
    
    return UnreadCountResponse(
        unread_count=unread_count,
        critical_count=critical_count,
        high_count=high_count
    )


@router.post("/mark-read", status_code=status.HTTP_204_NO_CONTENT, summary="Mark notifications as read")
async def mark_notifications_read(
    request: MarkReadRequest,
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Mark specific notifications as read.
    """
    # Update only notifications belonging to this user or broadcasts
    db.query(Notification).filter(
        Notification.id.in_(request.notification_ids),
        or_(
            Notification.user_id == current_user.id,
            Notification.user_id.is_(None)
        ),
        Notification.is_read == False
    ).update(
        {"is_read": True, "read_at": datetime.utcnow()},
        synchronize_session=False
    )
    db.commit()


@router.post("/mark-all-read", status_code=status.HTTP_204_NO_CONTENT, summary="Mark all notifications as read")
async def mark_all_notifications_read(
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Mark all notifications as read for the current user.
    """
    db.query(Notification).filter(
        or_(
            Notification.user_id == current_user.id,
            Notification.user_id.is_(None)
        ),
        Notification.is_read == False
    ).update(
        {"is_read": True, "read_at": datetime.utcnow()},
        synchronize_session=False
    )
    db.commit()


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete notification")
async def delete_notification(
    notification_id: int,
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Delete a notification (soft delete by marking as expired).
    Users can only delete their own notifications, not broadcasts.
    """
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id  # Can only delete own notifications
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or cannot be deleted"
        )
    
    db.delete(notification)
    db.commit()


class DeleteNotificationsRequest(BaseModel):
    """Schema for bulk deleting notifications."""
    notification_ids: List[int] = Field(..., min_length=1, description="List of notification IDs to delete")


@router.post("/delete", status_code=status.HTTP_204_NO_CONTENT, summary="Delete multiple notifications")
async def delete_notifications(
    request: DeleteNotificationsRequest,
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Delete multiple notifications at once.
    Users can only delete notifications targeted to them (not broadcasts).
    """
    # Delete only notifications belonging to this user
    deleted_count = db.query(Notification).filter(
        Notification.id.in_(request.notification_ids),
        Notification.user_id == current_user.id  # Can only delete own notifications, not broadcasts
    ).delete(synchronize_session=False)
    
    db.commit()
    
    if deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No notifications found that can be deleted"
        )


@router.get("/preferences", response_model=NotificationPreferencesResponse, summary="Get notification preferences")
async def get_notification_preferences(
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Get current user's notification preferences.
    """
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    
    if not prefs:
        # Create default preferences if not exist
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    
    # Parse notification settings JSON
    try:
        notification_settings = json.loads(prefs.notification_settings or '{}')
    except json.JSONDecodeError:
        notification_settings = {}
    
    return NotificationPreferencesResponse(
        notification_settings=notification_settings,
        email_notifications_enabled=prefs.email_notifications_enabled,
        email_digest_frequency=prefs.email_digest_frequency
    )


@router.patch("/preferences", response_model=NotificationPreferencesResponse, summary="Update notification preferences")
async def update_notification_preferences(
    updates: NotificationPreferencesUpdate,
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Update current user's notification preferences.
    """
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
    
    if updates.notification_settings is not None:
        prefs.notification_settings = json.dumps(updates.notification_settings)
    
    if updates.email_notifications_enabled is not None:
        prefs.email_notifications_enabled = updates.email_notifications_enabled
    
    if updates.email_digest_frequency is not None:
        prefs.email_digest_frequency = updates.email_digest_frequency
    
    db.commit()
    db.refresh(prefs)
    
    # Parse notification settings JSON for response
    try:
        notification_settings = json.loads(prefs.notification_settings or '{}')
    except json.JSONDecodeError:
        notification_settings = {}
    
    return NotificationPreferencesResponse(
        notification_settings=notification_settings,
        email_notifications_enabled=prefs.email_notifications_enabled,
        email_digest_frequency=prefs.email_digest_frequency
    )


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/admin/create", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED, summary="Create notification (Admin)")
async def admin_create_notification(
    notification: CreateNotificationRequest,
    current_user: Annotated[User, Depends(auth_service.require_admin)],
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to create a notification.
    Can be targeted to a specific user or broadcast to all users.
    Requires admin role.
    """
    # If targeted to a user, verify user exists
    if notification.user_id:
        target_user = db.query(User).filter(User.id == notification.user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target user with ID {notification.user_id} not found"
            )
    
    new_notification = Notification(
        user_id=notification.user_id,
        type=notification.type,
        priority=notification.priority,
        title=notification.title,
        message=notification.message,
        data=json.dumps(notification.data) if notification.data else None,
        action_url=notification.action_url,
        action_label=notification.action_label,
        expires_at=notification.expires_at
    )
    
    db.add(new_notification)
    db.commit()
    db.refresh(new_notification)
    
    return NotificationResponse.from_orm_with_data(new_notification)


@router.delete("/admin/{notification_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete any notification (Admin)")
async def admin_delete_notification(
    notification_id: int,
    current_user: Annotated[User, Depends(auth_service.require_admin)],
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to delete any notification.
    Requires admin role.
    """
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    db.delete(notification)
    db.commit()
