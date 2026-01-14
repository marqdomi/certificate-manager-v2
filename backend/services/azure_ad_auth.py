# backend/services/azure_ad_auth.py
"""
Azure AD (Microsoft Entra ID) Authentication Service

Provides authentication and authorization using Azure AD tokens.
Supports both Azure AD SSO and fallback to local authentication.
"""

import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from functools import lru_cache

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2AuthorizationCodeBearer, HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, jwk
from jose.exceptions import JWKError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.config import settings
from core.logger import logger
from db.base import get_db
from db.models import User, UserRole


# ============================================
# Configuration
# ============================================

class AzureADConfig(BaseModel):
    """Azure AD configuration"""
    tenant_id: str
    client_id: str
    authority: str
    audience: str
    issuer: str
    jwks_uri: str
    
    @classmethod
    def from_env(cls) -> Optional["AzureADConfig"]:
        """Load configuration from environment variables"""
        tenant_id = getattr(settings, 'AZURE_AD_TENANT_ID', None)
        client_id = getattr(settings, 'AZURE_AD_CLIENT_ID', None)
        
        if not tenant_id or not client_id:
            return None
            
        return cls(
            tenant_id=tenant_id,
            client_id=client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            audience=f"api://{client_id}",
            issuer=f"https://sts.windows.net/{tenant_id}/",
            jwks_uri=f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
        )


# Global config - lazily loaded
_azure_config: Optional[AzureADConfig] = None

def get_azure_config() -> Optional[AzureADConfig]:
    """Get Azure AD configuration (cached)"""
    global _azure_config
    if _azure_config is None:
        _azure_config = AzureADConfig.from_env()
    return _azure_config

def is_azure_ad_enabled() -> bool:
    """Check if Azure AD authentication is enabled"""
    auth_mode = getattr(settings, 'AUTH_MODE', 'local')
    return auth_mode in ('azure_ad', 'hybrid') and get_azure_config() is not None


# ============================================
# Token Classes
# ============================================

class AzureADUser(BaseModel):
    """Represents a user authenticated via Azure AD"""
    oid: str  # Object ID (unique identifier)
    email: Optional[str] = None
    name: Optional[str] = None
    preferred_username: Optional[str] = None
    roles: List[str] = []
    groups: List[str] = []
    tenant_id: str
    
    @property
    def username(self) -> str:
        """Get username from preferred_username or email"""
        return self.preferred_username or self.email or self.oid
    
    @property
    def primary_role(self) -> UserRole:
        """Map Azure AD roles to application roles"""
        if 'admin' in self.roles:
            return UserRole.ADMIN
        elif 'operator' in self.roles:
            return UserRole.OPERATOR
        else:
            return UserRole.VIEWER


# ============================================
# JWKS Cache for Token Validation
# ============================================

class JWKSCache:
    """Cache for Azure AD JWKS (JSON Web Key Set)"""
    
    def __init__(self):
        self._keys: Dict[str, Any] = {}
        self._last_refresh: Optional[datetime] = None
        self._refresh_interval = 3600  # 1 hour
    
    async def get_key(self, kid: str, jwks_uri: str) -> Optional[Dict[str, Any]]:
        """Get a specific key by key ID"""
        if self._should_refresh():
            await self._refresh_keys(jwks_uri)
        return self._keys.get(kid)
    
    def _should_refresh(self) -> bool:
        """Check if keys should be refreshed"""
        if not self._last_refresh:
            return True
        elapsed = (datetime.now(timezone.utc) - self._last_refresh).total_seconds()
        return elapsed > self._refresh_interval
    
    async def _refresh_keys(self, jwks_uri: str) -> None:
        """Refresh keys from Azure AD"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(jwks_uri, timeout=10)
                response.raise_for_status()
                jwks = response.json()
                
                self._keys = {key['kid']: key for key in jwks.get('keys', [])}
                self._last_refresh = datetime.now(timezone.utc)
                logger.info(f"Refreshed JWKS cache with {len(self._keys)} keys")
        except Exception as e:
            logger.error(f"Failed to refresh JWKS: {e}")
            # Keep existing keys if refresh fails


# Global JWKS cache
_jwks_cache = JWKSCache()


# ============================================
# Token Validation
# ============================================

async def validate_azure_ad_token(token: str) -> AzureADUser:
    """
    Validate an Azure AD access token.
    
    Args:
        token: JWT access token from Azure AD
        
    Returns:
        AzureADUser with validated claims
        
    Raises:
        HTTPException: If token is invalid
    """
    config = get_azure_config()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Azure AD is not configured"
        )
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate Azure AD credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode header to get key ID
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get('kid')
        
        if not kid:
            raise credentials_exception
        
        # Get signing key
        key = await _jwks_cache.get_key(kid, config.jwks_uri)
        if not key:
            raise credentials_exception
        
        # Validate and decode token
        payload = jwt.decode(
            token,
            key,
            algorithms=['RS256'],
            audience=[config.client_id, config.audience],
            issuer=[config.issuer, f"https://login.microsoftonline.com/{config.tenant_id}/v2.0"],
            options={
                'verify_exp': True,
                'verify_iat': True,
                'verify_aud': True,
                'verify_iss': True,
            }
        )
        
        # Extract user information
        return AzureADUser(
            oid=payload.get('oid') or payload.get('sub'),
            email=payload.get('email') or payload.get('upn'),
            name=payload.get('name'),
            preferred_username=payload.get('preferred_username'),
            roles=payload.get('roles', []),
            groups=payload.get('groups', []),
            tenant_id=payload.get('tid', config.tenant_id)
        )
        
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise credentials_exception
    except JWKError as e:
        logger.warning(f"JWK error: {e}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected error validating token: {e}")
        raise credentials_exception


# ============================================
# User Sync
# ============================================

async def get_or_create_azure_user(
    azure_user: AzureADUser, 
    db: Session
) -> User:
    """
    Get or create a local user record from Azure AD user.
    
    This syncs Azure AD users to local database for:
    - Tracking user activity
    - Local permissions/preferences
    - Audit trail
    """
    # Try to find existing user by Azure OID
    user = db.query(User).filter(User.azure_oid == azure_user.oid).first()
    
    if user:
        # Update user info from Azure AD
        user.email = azure_user.email
        user.full_name = azure_user.name
        user.role = azure_user.primary_role
        user.last_login = datetime.now(timezone.utc)
        db.commit()
        return user
    
    # Try to find by email (for migration)
    if azure_user.email:
        user = db.query(User).filter(User.email == azure_user.email).first()
        if user:
            # Link existing user to Azure AD
            user.azure_oid = azure_user.oid
            user.auth_provider = 'azure_ad'
            user.last_login = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"Linked existing user {user.username} to Azure AD")
            return user
    
    # Create new user
    username = azure_user.username.split('@')[0]  # Use part before @ as username
    
    # Ensure unique username
    base_username = username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1
    
    user = User(
        username=username,
        email=azure_user.email,
        full_name=azure_user.name,
        role=azure_user.primary_role,
        is_active=True,
        azure_oid=azure_user.oid,
        auth_provider='azure_ad',
        hashed_password='',  # No password for Azure AD users
        last_login=datetime.now(timezone.utc)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    logger.info(f"Created new user {user.username} from Azure AD")
    return user


# ============================================
# FastAPI Dependencies
# ============================================

# Bearer token extractor
bearer_scheme = HTTPBearer(auto_error=False)

async def get_current_user_azure_ad(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI dependency to get current user from Azure AD token.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    azure_user = await validate_azure_ad_token(credentials.credentials)
    user = await get_or_create_azure_user(azure_user, db)
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    
    return user


# ============================================
# Hybrid Authentication (Azure AD + Local)
# ============================================

async def get_current_user_hybrid(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Hybrid authentication that supports both Azure AD and local tokens.
    
    Token detection:
    - Azure AD tokens have 'iss' starting with 'https://sts.windows.net' or 'https://login.microsoftonline.com'
    - Local tokens have our JWT secret signature
    """
    from services.auth_service import get_current_user, oauth2_scheme
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    # Try to detect token type from issuer
    try:
        unverified = jwt.get_unverified_claims(token)
        issuer = unverified.get('iss', '')
        
        if 'microsoftonline.com' in issuer or 'sts.windows.net' in issuer:
            # Azure AD token
            if is_azure_ad_enabled():
                azure_user = await validate_azure_ad_token(token)
                return await get_or_create_azure_user(azure_user, db)
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Azure AD authentication is not enabled"
                )
        else:
            # Local token - use existing auth service
            return await get_current_user(token, db)
            
    except JWTError:
        # If we can't decode claims, try local auth
        return await get_current_user(token, db)


# ============================================
# Auth Mode Selection
# ============================================

def get_auth_dependency():
    """
    Return the appropriate authentication dependency based on configuration.
    """
    auth_mode = getattr(settings, 'AUTH_MODE', 'local')
    
    if auth_mode == 'azure_ad':
        return get_current_user_azure_ad
    elif auth_mode == 'hybrid':
        return get_current_user_hybrid
    else:
        from services.auth_service import get_current_user
        return get_current_user
