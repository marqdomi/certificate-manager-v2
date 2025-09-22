# backend/api/endpoints/admin.py

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json

from db.base import get_db
from db.models import (
    User, UserRole, AuthType, UserActivity, UserSession, 
    SystemConfig, Device, Certificate
)
from services import auth_service
from services.encryption_service import encrypt_data, decrypt_data
from schemas.user import (
    UserResponse, UserCreate, UserUpdate, UserPasswordUpdate,
    UserListResponse, UserActivityResponse, SystemConfigResponse,
    SystemConfigUpdate, ADSyncResult
)

router = APIRouter()

# Dependency for admin-only access
admin_required = auth_service.require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN])
super_admin_required = auth_service.require_role([UserRole.SUPER_ADMIN])

@router.get("/users", response_model=UserListResponse, summary="List Users")
async def list_users(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[UserRole] = Query(None),
    auth_type: Optional[AuthType] = Query(None),
    is_active: Optional[bool] = Query(None)
):
    """
    Get list of users with filtering and pagination
    """
    query = db.query(User)
    
    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (User.username.ilike(search_filter)) |
            (User.full_name.ilike(search_filter)) |
            (User.email.ilike(search_filter)) |
            (User.department.ilike(search_filter))
        )
    
    if role:
        query = query.filter(User.role == role)
    
    if auth_type:
        query = query.filter(User.auth_type == auth_type)
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    # Get total count
    total = query.count()
    
    # Apply pagination and ordering
    users = query.order_by(desc(User.created_at)).offset((page - 1) * size).limit(size).all()
    
    return UserListResponse(
        users=users,
        total=total,
        page=page,
        size=size
    )


@router.post("/users", response_model=UserResponse, summary="Create User")
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """
    Create a new user
    """
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Check if email already exists (if provided)
    if user_data.email:
        existing_email = db.query(User).filter(User.email == user_data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
    
    # Hash password for local users
    hashed_password = None
    if user_data.auth_type == AuthType.LOCAL and user_data.password:
        hashed_password = auth_service.hash_password(user_data.password)
    
    # Create user
    user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        department=user_data.department,
        phone=user_data.phone,
        role=user_data.role,
        auth_type=user_data.auth_type,
        domain=user_data.domain,
        hashed_password=hashed_password,
        permissions=json.dumps(user_data.permissions) if user_data.permissions else None,
        is_active=user_data.is_active,
        created_by=current_user.username
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Log activity
    auth_service._log_user_activity(
        current_user,
        "create_user", 
        db,
        resource_type="user",
        resource_id=str(user.id),
        description=f"Created user: {user.username}"
    )
    
    return user


@router.get("/users/{user_id}", response_model=UserResponse, summary="Get User")
async def get_user(
    user_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """
    Get user by ID
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.put("/users/{user_id}", response_model=UserResponse, summary="Update User")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """
    Update user information
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if email already exists (if being updated)
    if user_data.email and user_data.email != user.email:
        existing_email = db.query(User).filter(User.email == user_data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
    
    # Update fields
    update_data = user_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == "permissions":
            setattr(user, field, json.dumps(value) if value else None)
        else:
            setattr(user, field, value)
    
    user.last_modified_by = current_user.username
    user.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    
    # Log activity
    auth_service._log_user_activity(
        current_user,
        "update_user",
        db,
        resource_type="user", 
        resource_id=str(user.id),
        description=f"Updated user: {user.username}"
    )
    
    return user


@router.delete("/users/{user_id}", summary="Delete User")
async def delete_user(
    user_id: int,
    current_user: User = Depends(super_admin_required),
    db: Session = Depends(get_db)
):
    """
    Delete user (Super Admin only)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deleting self
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    # Prevent deleting other super admins (unless you're also super admin)
    if user.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete super admin users"
        )
    
    username = user.username
    db.delete(user)
    db.commit()
    
    # Log activity
    auth_service._log_user_activity(
        current_user,
        "delete_user",
        db,
        resource_type="user",
        resource_id=str(user_id),
        description=f"Deleted user: {username}"
    )
    
    return {"message": f"User {username} deleted successfully"}


@router.post("/users/{user_id}/password", summary="Update User Password")
async def update_user_password(
    user_id: int,
    password_data: UserPasswordUpdate,
    current_user: User = Depends(auth_service.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update user password (users can update their own, admins can update any)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check permissions
    if user.id != current_user.id and current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only change your own password"
        )
    
    # For local users only
    if user.auth_type != AuthType.LOCAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change password for external authentication users"
        )
    
    # Verify current password if user is changing their own
    if user.id == current_user.id:
        if not user.hashed_password or not auth_service.verify_password(
            password_data.current_password, user.hashed_password
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
    
    # Update password
    user.hashed_password = auth_service.hash_password(password_data.new_password)
    user.must_change_password = False
    user.password_expires_at = None
    user.last_modified_by = current_user.username
    user.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Log activity
    auth_service._log_user_activity(
        current_user,
        "change_password",
        db,
        resource_type="user",
        resource_id=str(user.id),
        description=f"Password changed for user: {user.username}"
    )
    
    return {"message": "Password updated successfully"}


@router.post("/users/{user_id}/unlock", summary="Unlock User Account")
async def unlock_user(
    user_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """
    Unlock a locked user account
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_locked = False
    user.failed_login_attempts = 0
    user.last_failed_login = None
    user.last_modified_by = current_user.username
    user.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Log activity
    auth_service._log_user_activity(
        current_user,
        "unlock_user",
        db,
        resource_type="user",
        resource_id=str(user.id),
        description=f"Unlocked user account: {user.username}"
    )
    
    return {"message": f"User {user.username} unlocked successfully"}


@router.get("/users/{user_id}/activity", response_model=List[UserActivityResponse], summary="Get User Activity")
async def get_user_activity(
    user_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None)
):
    """
    Get user activity log
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    query = db.query(UserActivity).filter(UserActivity.user_id == user_id)
    
    if action:
        query = query.filter(UserActivity.action == action)
    
    activities = query.order_by(desc(UserActivity.created_at)).limit(limit).all()
    
    return activities


@router.get("/system/stats", summary="Get System Statistics")
async def get_system_stats(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db)
):
    """
    Get system statistics for admin dashboard
    """
    # User statistics
    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    locked_users = db.query(func.count(User.id)).filter(User.is_locked == True).scalar()
    
    # Users by auth type
    users_by_auth = db.query(User.auth_type, func.count(User.id)).group_by(User.auth_type).all()
    
    # Users by role
    users_by_role = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    
    # Recent login activity (last 24 hours)
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_logins = db.query(func.count(UserActivity.id)).filter(
        UserActivity.action == "login",
        UserActivity.result == "success",
        UserActivity.created_at >= yesterday
    ).scalar()
    
    # Failed login attempts (last 24 hours)
    failed_logins = db.query(func.count(UserActivity.id)).filter(
        UserActivity.action == "login",
        UserActivity.result == "failure",
        UserActivity.created_at >= yesterday
    ).scalar()
    
    # Device and certificate counts
    total_devices = db.query(func.count(Device.id)).scalar()
    active_devices = db.query(func.count(Device.id)).filter(Device.active == True).scalar()
    total_certificates = db.query(func.count(Certificate.id)).scalar()
    
    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "locked": locked_users,
            "by_auth_type": dict(users_by_auth),
            "by_role": dict(users_by_role)
        },
        "activity": {
            "recent_logins_24h": recent_logins,
            "failed_logins_24h": failed_logins
        },
        "resources": {
            "total_devices": total_devices,
            "active_devices": active_devices,
            "total_certificates": total_certificates
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/system/activity", response_model=List[UserActivityResponse], summary="Get System Activity Log")
async def get_system_activity(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    result: Optional[str] = Query(None)
):
    """
    Get system-wide activity log
    """
    query = db.query(UserActivity)
    
    # Apply filters
    if action:
        query = query.filter(UserActivity.action == action)
    
    if username:
        query = query.filter(UserActivity.username.ilike(f"%{username}%"))
    
    if result:
        query = query.filter(UserActivity.result == result)
    
    # Apply pagination
    activities = query.order_by(desc(UserActivity.created_at)).offset((page - 1) * size).limit(size).all()
    
    return activities