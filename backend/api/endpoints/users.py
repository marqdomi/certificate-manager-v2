# backend/api/endpoints/users.py
"""
User Management API endpoints for CMT Enterprise Admin Panel.
Provides CRUD operations for user accounts with role-based access control.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Annotated, List, Optional
from datetime import datetime

from db.base import get_db
from db.models import User, UserRole, UserPreferences
from services import auth_service
from services.audit_service import AuditLogger, AuditAction
from core.rate_limiter import limiter, ADMIN_RATE_LIMIT
from pydantic import BaseModel, ConfigDict, Field, field_validator
import re

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class UserCreate(BaseModel):
    """Schema for creating a new user."""
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    password: str = Field(..., min_length=8, max_length=100, description="Password (min 8 chars)")
    role: UserRole = Field(default=UserRole.VIEWER, description="User role")
    is_active: bool = Field(default=True, description="Whether user is active")

    @field_validator('username')
    @classmethod
    def username_alphanumeric(cls, v):
        if not re.match(r'^[a-zA-Z0-9_.-]+$', v):
            raise ValueError('Username must contain only alphanumeric characters, dots, dashes, and underscores')
        return v.lower()

    @field_validator('password')
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    role: Optional[UserRole] = Field(None, description="New user role")
    is_active: Optional[bool] = Field(None, description="Active status")


class UserChangePassword(BaseModel):
    """Schema for changing user password."""
    current_password: str = Field(..., description="Current password (for non-admin users)")
    new_password: str = Field(..., min_length=8, max_length=100, description="New password")

    @field_validator('new_password')
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        return v


class AdminResetPassword(BaseModel):
    """Schema for admin to reset user password."""
    new_password: str = Field(..., min_length=8, max_length=100, description="New password")

    @field_validator('new_password')
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserResponse(BaseModel):
    """Schema for user response."""
    id: int
    username: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


class UserListResponse(BaseModel):
    """Schema for paginated user list response."""
    items: List[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class UserStats(BaseModel):
    """Schema for user statistics."""
    total_users: int
    active_users: int
    inactive_users: int
    by_role: dict


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=UserListResponse, summary="List all users")
@limiter.limit(ADMIN_RATE_LIMIT)
async def list_users(
    request: Request,
    current_user: Annotated[User, Depends(auth_service.require_admin)],
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by username"),
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status")
):
    """
    List all users with pagination and filtering.
    Requires admin role.
    """
    query = db.query(User)
    
    # Apply filters
    if search:
        query = query.filter(User.username.ilike(f"%{search}%"))
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    users = query.order_by(User.created_at.desc()).offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return UserListResponse(
        items=users,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/stats", response_model=UserStats, summary="Get user statistics")
@limiter.limit(ADMIN_RATE_LIMIT)
async def get_user_stats(
    request: Request,
    current_user: Annotated[User, Depends(auth_service.require_admin)],
    db: Session = Depends(get_db)
):
    """
    Get user statistics for admin dashboard.
    Requires admin role.
    """
    total = db.query(User).count()
    active = db.query(User).filter(User.is_active == True).count()
    
    # Count by role
    role_counts = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    by_role = {role.value: count for role, count in role_counts}
    
    return UserStats(
        total_users=total,
        active_users=active,
        inactive_users=total - active,
        by_role=by_role
    )


@router.get("/{user_id}", response_model=UserResponse, summary="Get user by ID")
@limiter.limit(ADMIN_RATE_LIMIT)
async def get_user(
    request: Request,
    user_id: int,
    current_user: Annotated[User, Depends(auth_service.require_admin)],
    db: Session = Depends(get_db)
):
    """
    Get a specific user by ID.
    Requires admin role.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    return user


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Create new user")
@limiter.limit(ADMIN_RATE_LIMIT)
async def create_user(
    request: Request,
    user_data: UserCreate,
    current_user: Annotated[User, Depends(auth_service.require_admin)],
    db: Session = Depends(get_db),
    audit: AuditLogger = Depends()
):
    """
    Create a new user account.
    Requires admin role.
    """
    # Check if username already exists
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{user_data.username}' already exists"
        )
    
    # Create new user
    new_user = User(
        username=user_data.username,
        hashed_password=auth_service.get_password_hash(user_data.password),
        role=user_data.role,
        is_active=user_data.is_active
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create default preferences for the user
    preferences = UserPreferences(user_id=new_user.id)
    db.add(preferences)
    db.commit()
    
    # Log audit event
    await audit.log(
        action=AuditAction.USER_CREATED,
        resource_type="user",
        resource_id=new_user.id,
        resource_name=new_user.username,
        description=f"User '{new_user.username}' created with role '{new_user.role.value}'"
    )
    
    return new_user


@router.patch("/{user_id}", response_model=UserResponse, summary="Update user")
@limiter.limit(ADMIN_RATE_LIMIT)
async def update_user(
    request: Request,
    user_id: int,
    user_data: UserUpdate,
    current_user: Annotated[User, Depends(auth_service.require_admin)],
    db: Session = Depends(get_db),
    audit: AuditLogger = Depends()
):
    """
    Update a user's role or active status.
    Requires admin role. Cannot modify own account.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify your own account through this endpoint"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    changes = []
    
    if user_data.role is not None and user_data.role != user.role:
        old_role = user.role.value
        user.role = user_data.role
        changes.append(f"role: {old_role} -> {user_data.role.value}")
    
    if user_data.is_active is not None and user_data.is_active != user.is_active:
        user.is_active = user_data.is_active
        status_str = "activated" if user_data.is_active else "deactivated"
        changes.append(status_str)
    
    if changes:
        db.commit()
        db.refresh(user)
        
        # Log audit event
        await audit.log(
            action=AuditAction.USER_MODIFIED,
            resource_type="user",
            resource_id=user.id,
            resource_name=user.username,
            description=f"User '{user.username}' updated: {', '.join(changes)}"
        )
    
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete user")
@limiter.limit(ADMIN_RATE_LIMIT)
async def delete_user(
    request: Request,
    user_id: int,
    current_user: Annotated[User, Depends(auth_service.require_admin)],
    db: Session = Depends(get_db),
    audit: AuditLogger = Depends()
):
    """
    Delete a user account.
    Requires admin role. Cannot delete own account.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete your own account"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    username = user.username
    db.delete(user)
    db.commit()
    
    # Log audit event
    await audit.log(
        action=AuditAction.USER_MODIFIED,  # Using USER_MODIFIED for delete (could add USER_DELETED)
        resource_type="user",
        resource_id=user_id,
        resource_name=username,
        description=f"User '{username}' deleted"
    )


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT, summary="Admin reset password")
@limiter.limit(ADMIN_RATE_LIMIT)
async def admin_reset_password(
    request: Request,
    user_id: int,
    password_data: AdminResetPassword,
    current_user: Annotated[User, Depends(auth_service.require_admin)],
    db: Session = Depends(get_db),
    audit: AuditLogger = Depends()
):
    """
    Admin endpoint to reset a user's password.
    Requires admin role.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    user.hashed_password = auth_service.get_password_hash(password_data.new_password)
    db.commit()
    
    # Log audit event
    await audit.log(
        action=AuditAction.USER_MODIFIED,
        resource_type="user",
        resource_id=user.id,
        resource_name=user.username,
        description=f"Password reset for user '{user.username}' by admin"
    )


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT, summary="Change own password")
async def change_own_password(
    password_data: UserChangePassword,
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)],
    db: Session = Depends(get_db),
    audit: AuditLogger = Depends()
):
    """
    Change your own password.
    Requires current password verification.
    """
    # Verify current password
    if not auth_service.verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.hashed_password = auth_service.get_password_hash(password_data.new_password)
    db.commit()
    
    # Log audit event
    await audit.log(
        action=AuditAction.USER_MODIFIED,
        resource_type="user",
        resource_id=current_user.id,
        resource_name=current_user.username,
        description=f"User '{current_user.username}' changed their password"
    )
