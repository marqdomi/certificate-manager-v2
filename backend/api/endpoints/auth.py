# backend/api/endpoints/auth.py

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Annotated, Optional
from datetime import datetime, timezone
from pydantic import BaseModel

from db.base import get_db
from db.models import User
from services import auth_service
from schemas.user import UserResponse
from core.config import settings

router = APIRouter()


# ============================================
# Azure AD Configuration Response
# ============================================

class AuthConfig(BaseModel):
    """Authentication configuration for frontend"""
    auth_mode: str  # 'local' | 'radius' | 'azure_ad' | 'hybrid'
    azure_ad_enabled: bool
    radius_enabled: bool = False
    azure_ad_tenant_id: Optional[str] = None
    azure_ad_client_id: Optional[str] = None
    azure_ad_authority: Optional[str] = None
    local_auth_enabled: bool


class AzureADLoginRequest(BaseModel):
    """Request body for Azure AD token exchange"""
    id_token: str


class TokenResponse(BaseModel):
    """Token response"""
    access_token: str
    token_type: str = "bearer"
    user: Optional[dict] = None


# ============================================
# Auth Config Endpoint
# ============================================

@router.get("/config", response_model=AuthConfig, summary="Get Auth Configuration")
def get_auth_config():
    """
    Returns authentication configuration for the frontend.
    This allows the frontend to know which auth methods are available.
    """
    from services.radius_auth import is_radius_enabled
    
    auth_mode = getattr(settings, 'AUTH_MODE', 'local')
    azure_enabled = auth_mode in ('azure_ad', 'hybrid') and \
                    getattr(settings, 'AZURE_AD_CLIENT_ID', None) is not None
    radius_enabled = auth_mode in ('radius', 'hybrid') and is_radius_enabled()
    
    return AuthConfig(
        auth_mode=auth_mode,
        azure_ad_enabled=azure_enabled,
        radius_enabled=radius_enabled,
        azure_ad_tenant_id=getattr(settings, 'AZURE_AD_TENANT_ID', None) if azure_enabled else None,
        azure_ad_client_id=getattr(settings, 'AZURE_AD_CLIENT_ID', None) if azure_enabled else None,
        azure_ad_authority=f"https://login.microsoftonline.com/{settings.AZURE_AD_TENANT_ID}" if azure_enabled else None,
        local_auth_enabled=auth_mode in ('local', 'hybrid')
    )


# ============================================
# Local Authentication (Also supports RADIUS in hybrid mode)
# ============================================

@router.post("/token", response_model=TokenResponse, summary="User Login")
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], 
    db: Session = Depends(get_db)
):
    """
    Endpoint de login con usuario/contraseña.
    
    Soporta múltiples modos de autenticación según AUTH_MODE:
    - 'local': Solo autenticación contra base de datos local
    - 'radius': Solo autenticación contra NPS/RADIUS (Active Directory)
    - 'hybrid': Intenta RADIUS primero, si falla intenta local
    - 'azure_ad': Solo Azure AD (este endpoint no aplica)
    """
    auth_mode = getattr(settings, 'AUTH_MODE', 'local')
    if auth_mode == 'azure_ad':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Local authentication is disabled. Use Azure AD login."
        )
    
    # Usar la nueva función que soporta RADIUS + local
    user = auth_service.authenticate_user(form_data.username, form_data.password, db)
    
    if not user:
        # Mensaje de error según el modo de autenticación
        if auth_mode == 'radius':
            detail = "Invalid Active Directory credentials"
        elif auth_mode == 'hybrid':
            detail = "Invalid credentials (tried RADIUS and local)"
        else:
            detail = "Incorrect username or password"
            
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verificar que el usuario esté activo
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Crear el token de acceso
    access_token = auth_service.create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "role": user.role.value,
            "email": user.email,
            "full_name": user.full_name,
            "auth_provider": user.auth_provider or "local"
        }
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "auth_provider": user.auth_provider or "local"
        }
    )


# ============================================
# Azure AD Authentication
# ============================================

bearer_scheme = HTTPBearer(auto_error=False)

@router.post("/azure-ad/token", response_model=TokenResponse, summary="Azure AD Login")
async def login_with_azure_ad(
    request: AzureADLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Exchange Azure AD ID token for application token.
    
    The frontend authenticates with Azure AD and receives an ID token.
    This endpoint validates that token and returns an app-specific JWT.
    """
    from services.azure_ad_auth import (
        is_azure_ad_enabled, 
        validate_azure_ad_token, 
        get_or_create_azure_user
    )
    
    if not is_azure_ad_enabled():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Azure AD authentication is not enabled"
        )
    
    # Validate Azure AD token
    azure_user = await validate_azure_ad_token(request.id_token)
    
    # Get or create local user
    user = await get_or_create_azure_user(azure_user, db)
    
    # Create application token
    access_token = auth_service.create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "role": user.role.value,
            "email": user.email,
            "full_name": user.full_name,
            "auth_provider": "azure_ad",
            "azure_oid": azure_user.oid
        }
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "auth_provider": "azure_ad"
        }
    )


# ============================================
# Current User
# ============================================

@router.get("/users/me", response_model=UserResponse)
async def read_users_me(
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)]
):
    """
    Endpoint protegido que devuelve la información del usuario logueado.
    """
    return current_user


# ============================================
# RADIUS/NPS Authentication Endpoints
# ============================================

class RadiusTestResult(BaseModel):
    """Result of RADIUS connection test"""
    success: bool
    message: str
    server: Optional[str] = None
    port: Optional[int] = None


class RadiusUserInfo(BaseModel):
    """RADIUS user information"""
    username: str
    groups: list[str] = []
    mapped_role: str
    attributes: dict = {}


@router.get("/radius/status", response_model=RadiusTestResult, summary="Check RADIUS Status")
def check_radius_status():
    """
    Check if RADIUS authentication is configured and server is reachable.
    Useful for diagnosing connection issues.
    """
    from services.radius_auth import is_radius_enabled, get_radius_service
    
    if not is_radius_enabled():
        return RadiusTestResult(
            success=False,
            message="RADIUS is not enabled. Set RADIUS_SERVER and RADIUS_SECRET environment variables."
        )
    
    radius_service = get_radius_service()
    if not radius_service:
        return RadiusTestResult(
            success=False,
            message="RADIUS service failed to initialize. Check configuration."
        )
    
    # Test connection
    success, message = radius_service.test_connection()
    
    return RadiusTestResult(
        success=success,
        message=message,
        server=radius_service.config.server if success else None,
        port=radius_service.config.port if success else None
    )


@router.post("/radius/test-auth", summary="Test RADIUS Authentication")
def test_radius_auth(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)]
):
    """
    Test RADIUS authentication for a specific user without creating a session.
    Requires ADMIN role.
    
    This is useful for testing RADIUS configuration before enabling it fully.
    """
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can test RADIUS authentication"
        )
    
    from services.radius_auth import is_radius_enabled, get_radius_service
    
    if not is_radius_enabled():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RADIUS is not enabled"
        )
    
    radius_service = get_radius_service()
    if not radius_service:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="RADIUS service not available"
        )
    
    radius_user = radius_service.authenticate(form_data.username, form_data.password)
    
    if not radius_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="RADIUS authentication failed"
        )
    
    return RadiusUserInfo(
        username=radius_user.username,
        groups=radius_user.groups,
        mapped_role=radius_user.role.value,
        attributes=radius_user.attributes
    )