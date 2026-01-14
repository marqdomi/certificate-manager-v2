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
    auth_mode: str  # 'local' | 'azure_ad' | 'hybrid'
    azure_ad_enabled: bool
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
    auth_mode = getattr(settings, 'AUTH_MODE', 'local')
    azure_enabled = auth_mode in ('azure_ad', 'hybrid') and \
                    getattr(settings, 'AZURE_AD_CLIENT_ID', None) is not None
    
    return AuthConfig(
        auth_mode=auth_mode,
        azure_ad_enabled=azure_enabled,
        azure_ad_tenant_id=getattr(settings, 'AZURE_AD_TENANT_ID', None) if azure_enabled else None,
        azure_ad_client_id=getattr(settings, 'AZURE_AD_CLIENT_ID', None) if azure_enabled else None,
        azure_ad_authority=f"https://login.microsoftonline.com/{settings.AZURE_AD_TENANT_ID}" if azure_enabled else None,
        local_auth_enabled=auth_mode in ('local', 'hybrid')
    )


# ============================================
# Local Authentication
# ============================================

@router.post("/token", response_model=TokenResponse, summary="User Login (Local)")
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], 
    db: Session = Depends(get_db)
):
    """
    Endpoint de login con usuario/contraseña local.
    Recibe username y password, devuelve un token JWT.
    """
    auth_mode = getattr(settings, 'AUTH_MODE', 'local')
    if auth_mode == 'azure_ad':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Local authentication is disabled. Use Azure AD login."
        )
    
    # 1. Buscamos al usuario en la BBDD
    user = db.query(User).filter(User.username == form_data.username).first()

    # 2. Verificamos que el usuario exista y que la contraseña sea correcta
    if not user or not auth_service.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Verificar que no sea un usuario de Azure AD intentando login local
    if user.auth_provider == 'azure_ad' and not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Azure AD authentication. Please login with Microsoft."
        )
    
    # 4. Actualizar último login
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    
    # 5. Creamos el token de acceso con toda la info del usuario
    access_token = auth_service.create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "role": user.role.value,
            "email": user.email,
            "full_name": user.full_name,
            "auth_provider": "local"
        }
    )

    # 6. Devolvemos el token
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value
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