# backend/api/endpoints/auth.py

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Annotated

from db.base import get_db
from db.models import User
from services import auth_service
from schemas.user import UserResponse # Crearemos este schema en el siguiente paso

router = APIRouter()


@router.post("/token", summary="User Login")
def login_for_access_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], 
    db: Session = Depends(get_db)
):
    """
    Endpoint de login híbrido. Soporta autenticación local y externa (LDAP/Azure AD).
    Recibe username y password, devuelve un token JWT.
    """
    # Get client info for audit logging
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    # Authenticate using hybrid method
    user, error_message = auth_service.authenticate_user_hybrid(
        form_data.username, 
        form_data.password, 
        db, 
        client_ip, 
        user_agent
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_message or "Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create JWT token
    access_token = auth_service.create_access_token(
        data={
            "sub": user.username, 
            "role": user.role.value,
            "auth_type": user.auth_type.value,
            "user_id": user.id
        }
    )

    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role.value,
            "auth_type": user.auth_type.value,
            "display_name": user.display_name,
            "is_ad_user": user.is_ad_user
        }
    }


@router.get("/users/me", response_model=UserResponse)
async def read_users_me(
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)]
):
    """
    Endpoint protegido que devuelve la información del usuario logueado.
    """
    return current_user


@router.post("/logout", summary="User Logout")
async def logout(
    request: Request,
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Endpoint de logout. Registra la actividad de logout.
    """
    # Get client info for audit logging
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    # Log logout activity
    auth_service._log_user_activity(
        current_user, 
        "logout", 
        db, 
        client_ip, 
        user_agent, 
        "success"
    )
    
    return {"message": "Logged out successfully"}


@router.get("/auth/providers", summary="Get Available Auth Providers")
async def get_auth_providers(db: Session = Depends(get_db)):
    """
    Get list of available authentication providers
    """
    providers = ["local"]
    
    # Check if external auth is enabled
    if auth_service._is_external_auth_enabled(db):
        try:
            from db.models import SystemConfig
            
            # Check LDAP
            ldap_enabled = db.query(SystemConfig).filter(
                SystemConfig.category == "ldap",
                SystemConfig.key == "enabled",
                SystemConfig.value == "true"
            ).first()
            if ldap_enabled:
                providers.append("ldap")
            
            # Check Azure AD
            azure_enabled = db.query(SystemConfig).filter(
                SystemConfig.category == "azure_ad",
                SystemConfig.key == "enabled", 
                SystemConfig.value == "true"
            ).first()
            if azure_enabled:
                providers.append("azure_ad")
                
        except Exception:
            pass
    
    return {"providers": providers}


@router.get("/auth/azure-ad/login-url", summary="Get Azure AD Login URL")
async def get_azure_ad_login_url(
    redirect_uri: str,
    state: str = None,
    db: Session = Depends(get_db)
):
    """
    Get Azure AD OAuth2 authorization URL
    """
    try:
        from services.azure_ad_service import AzureADService
        
        azure_service = AzureADService(db)
        auth_url = azure_service.get_authorization_url(redirect_uri, state)
        
        if not auth_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate Azure AD authorization URL"
            )
        
        return {"authorization_url": auth_url}
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Azure AD authentication not available"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Azure AD configuration error: {str(e)}"
        )


@router.post("/auth/azure-ad/callback", summary="Azure AD OAuth2 Callback")
async def azure_ad_callback(
    request: Request,
    authorization_code: str,
    redirect_uri: str,
    db: Session = Depends(get_db)
):
    """
    Handle Azure AD OAuth2 callback and create user session
    """
    try:
        from services.azure_ad_service import AzureADService
        
        # Get client info for audit logging
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        
        azure_service = AzureADService(db)
        user_info = azure_service.authenticate_with_code(authorization_code, redirect_uri)
        
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Azure AD authentication failed"
            )
        
        # Sync user from Azure AD
        user = azure_service.sync_user_from_azure_ad(user_info, "azure_ad_auth")
        
        # Update login info
        auth_service._update_user_login_info(user, db, client_ip, True)
        auth_service._log_user_activity(user, "login", db, client_ip, user_agent, "success")
        
        # Create JWT token
        access_token = auth_service.create_access_token(
            data={
                "sub": user.username,
                "role": user.role.value,
                "auth_type": user.auth_type.value,
                "user_id": user.id
            }
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role.value,
                "auth_type": user.auth_type.value,
                "display_name": user.display_name,
                "is_ad_user": user.is_ad_user
            }
        }
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Azure AD authentication not available"
        )
    except Exception as e:
        auth_service._log_user_activity_by_username(
            user_info.get('username', 'unknown') if 'user_info' in locals() else 'unknown',
            "login",
            db,
            client_ip,
            user_agent,
            "failure",
            str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Azure AD authentication error: {str(e)}"
        )