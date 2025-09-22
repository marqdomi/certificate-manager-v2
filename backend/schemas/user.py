# backend/schemas/user.py
from pydantic import BaseModel, ConfigDict, EmailStr, validator
from typing import Optional, List, Dict, Any
from datetime import datetime

# Base user schemas
class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    role: str  # Changed from UserRole enum to string
    auth_type: str = "local"  # Changed from AuthType enum to string
    domain: Optional[str] = None
    is_active: bool = True

class UserCreate(UserBase):
    password: Optional[str] = None  # Optional for AD users
    permissions: Optional[Dict[str, Any]] = None
    
    @validator('password')
    def validate_password(cls, v, values):
        if values.get('auth_type') == 'local' and not v:
            raise ValueError('Password is required for local users')
        return v

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None  # Changed from UserRole to str
    permissions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    is_locked: Optional[bool] = None
    must_change_password: Optional[bool] = None

class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    role: str  # Changed from UserRole to str
    auth_type: str  # Changed from AuthType to str
    domain: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None
    is_active: bool
    is_locked: bool
    last_login: Optional[datetime] = None
    login_count: int
    created_at: datetime
    updated_at: datetime
    
    # Computed fields
    display_name: Optional[str] = None
    is_ad_user: bool
    
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    size: int

# AD/LDAP specific schemas
class ADUserImport(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    domain: str
    distinguished_name: str
    ad_groups: List[str]
    role: str  # Changed from UserRole to str
    permissions: Optional[Dict[str, Any]] = None

class ADSyncResult(BaseModel):
    synced: int
    created: int
    updated: int
    errors: int
    details: List[Dict[str, Any]]

# Session schemas
class UserSessionResponse(BaseModel):
    id: int
    user_id: int
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime
    last_activity: datetime
    expires_at: datetime
    is_active: bool

# Activity audit schemas
class UserActivityResponse(BaseModel):
    id: int
    username: str
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    description: Optional[str]
    ip_address: Optional[str]
    result: str
    error_message: Optional[str]
    created_at: datetime

class UserActivityCreate(BaseModel):
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: Optional[str] = None
    result: str = "success"
    error_message: Optional[str] = None

# System configuration schemas
class SystemConfigResponse(BaseModel):
    id: int
    category: str
    key: str
    value: Optional[str]
    encrypted: bool
    description: Optional[str]
    updated_by: Optional[str]
    updated_at: datetime

class SystemConfigUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None