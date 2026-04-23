# backend/services/auth_service.py

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple
import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from db.base import get_db
from db.models import User, UserRole, AuthType, UserActivity
import os

logger = logging.getLogger(__name__)

# Prefer a dedicated JWT secret; fall back to ENCRYPTION_KEY for backward compatibility
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    JWT_SECRET = os.getenv("ENCRYPTION_KEY")
    if not JWT_SECRET:
        raise ValueError("JWT secret not configured. Set JWT_SECRET in environment (or ENCRYPTION_KEY as fallback).")

SECRET_KEY = JWT_SECRET
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 8)))  # default 8 hours

# Contexto para el hasheo de contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# NOTE: This is the single source of truth for hashing. All scripts must import from here.

# Esquema OAuth2 que le dice a FastAPI cómo esperar el token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


# --- FUNCIONES DE UTILIDAD ---

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña en texto plano contra su hash."""
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    """Genera el hash de una contraseña."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crea un nuevo token de acceso JWT."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# --- LOCAL AUTHENTICATION FUNCTIONS ---

def authenticate_user_hybrid(username: str, password: str, db: Session, 
                           ip_address: str = None, user_agent: str = None) -> Tuple[Optional[User], str]:
    """
    Local authentication only - simplified for better performance.
    
    Returns: (User object if successful, error_message if failed)
    """
    error_message = ""
    
    # Check if user exists locally
    local_user = db.query(User).filter(User.username == username).first()
    
    if not local_user:
        error_message = "Invalid username or password"
        return None, error_message
    
    # Verify user account status
    if not local_user.is_active:
        error_message = "User account is disabled"
        _log_user_activity(local_user, "login", db, ip_address, user_agent, "failure", error_message)
        return None, error_message
    
    if local_user.is_locked:
        error_message = "User account is locked"
        _log_user_activity(local_user, "login", db, ip_address, user_agent, "failure", error_message)
        return None, error_message
    
    if not local_user.hashed_password:
        error_message = "Local password not set for this user"
        _log_user_activity(local_user, "login", db, ip_address, user_agent, "failure", error_message)
        return None, error_message
    
    # Verify password
    if verify_password(password, local_user.hashed_password):
        # Successful local authentication
        _update_user_login_info(local_user, db, ip_address, True)
        _log_user_activity(local_user, "login", db, ip_address, user_agent, "success")
        return local_user, ""
    else:
        # Failed password
        _update_user_login_info(local_user, db, ip_address, False)
        error_message = "Invalid username or password"
        _log_user_activity(local_user, "login", db, ip_address, user_agent, "failure", error_message)
        return None, error_message
    
    # Log failed attempt even without user object
    if local_user:
        _log_user_activity(local_user, "login", db, ip_address, user_agent, "failure", error_message)
    else:
        _log_user_activity_by_username(username, "login", db, ip_address, user_agent, "failure", error_message)
    
    return None, error_message


# --- UTILITY FUNCTIONS FOR LOCAL AUTH ---


def _update_user_login_info(user: User, db: Session, ip_address: str = None, success: bool = True):
    """
    Update user login information
    """
    try:
        if success:
            user.last_login = datetime.utcnow()
            user.last_login_ip = ip_address
            user.login_count = (user.login_count or 0) + 1
            user.failed_login_attempts = 0
            user.last_failed_login = None
        else:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            user.last_failed_login = datetime.utcnow()
            
            # Lock account after too many failed attempts
            max_attempts = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
            if user.failed_login_attempts >= max_attempts:
                user.is_locked = True
                logger.warning(f"Account locked for user {user.username} after {max_attempts} failed attempts")
        
        db.commit()
        
    except Exception as e:
        logger.error(f"Error updating user login info: {e}")
        db.rollback()


def _log_user_activity(user: User, action: str, db: Session, ip_address: str = None, 
                      user_agent: str = None, result: str = "success", error_message: str = None):
    """
    Log user activity to audit trail
    """
    try:
        activity = UserActivity(
            user_id=user.id,
            username=user.username,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
            result=result,
            error_message=error_message
        )
        
        db.add(activity)
        db.commit()
        
    except Exception as e:
        logger.error(f"Error logging user activity: {e}")
        db.rollback()


def _log_user_activity_by_username(username: str, action: str, db: Session, ip_address: str = None,
                                 user_agent: str = None, result: str = "success", error_message: str = None):
    """
    Log user activity by username (when user object is not available)
    """
    try:
        activity = UserActivity(
            user_id=None,
            username=username,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
            result=result,
            error_message=error_message
        )
        
        db.add(activity)
        db.commit()
        
    except Exception as e:
        logger.error(f"Error logging user activity by username: {e}")
        db.rollback()


# --- DEPENDENCIAS DE FASTAPI ---

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Dependencia para obtener el usuario actual a partir de un token JWT.
    Valida el token y busca al usuario en la BBDD.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub") or payload.get("username")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependencia que asegura que el usuario obtenido del token esté activo.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if current_user.is_locked:
        raise HTTPException(status_code=400, detail="User account is locked")
    return current_user


def require_role(required_roles: List[str]):
    """
    Factoría de dependencias que crea una dependencia para requerir uno o más roles.
    """
    async def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        # Convert enum to string values for comparison
        required_role_strings = []
        for role in required_roles:
            if hasattr(role, 'value'):
                required_role_strings.append(role.value.upper())
            else:
                required_role_strings.append(str(role).upper())
        
        if current_user.role.upper() not in required_role_strings:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have enough permissions to perform this action.",
            )
        return current_user
    return role_checker


def require_permission(resource: str, action: str):
    """
    Decorator for granular permission checking
    """
    async def permission_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if not _check_user_permission(current_user, resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have permission to {action} {resource}.",
            )
        return current_user
    return permission_checker


def _check_user_permission(user: User, resource: str, action: str) -> bool:
    """
    Check if user has specific permission for resource/action
    """
    # Super admin has all permissions
    if user.role == UserRole.SUPER_ADMIN:
        return True
    
    # Admin has most permissions except super admin functions
    if user.role == UserRole.ADMIN and resource != "system" and action != "admin":
        return True
    
    # Role-based permissions
    role_permissions = {
        UserRole.CERTIFICATE_MANAGER: {
            "certificates": ["read", "write", "delete", "execute"],
            "devices": ["read"],
            "deployments": ["read", "write", "execute"]
        },
        UserRole.F5_OPERATOR: {
            "devices": ["read", "write", "execute"],
            "f5_operations": ["read", "write", "execute"],
            "certificates": ["read"]
        },
        UserRole.AUDITOR: {
            "certificates": ["read"],
            "devices": ["read"],
            "deployments": ["read"],
            "users": ["read"],
            "audit": ["read"]
        },
        UserRole.OPERATOR: {
            "certificates": ["read"],
            "devices": ["read"],
            "deployments": ["read"]
        },
        UserRole.VIEWER: {
            "certificates": ["read"],
            "devices": ["read"]
        }
    }
    
    permissions = role_permissions.get(user.role, {})
    allowed_actions = permissions.get(resource, [])
    
    return action in allowed_actions