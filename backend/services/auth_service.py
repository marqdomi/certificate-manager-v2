# backend/services/auth_service.py

import re
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from db.base import get_db
from db.models import User, UserRole

# Import centralized configuration - no more scattered os.getenv calls
from core.config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

# Use the centralized, validated JWT secret
SECRET_KEY = JWT_SECRET
ALGORITHM = JWT_ALGORITHM

# Contexto para el hasheo de contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# NOTE: This is the single source of truth for hashing. All scripts must import from here.

# Esquema OAuth2 que le dice a FastAPI cómo esperar el token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


# --- PASSWORD VALIDATION ---

# Password complexity requirements
PASSWORD_MIN_LENGTH = 8
PASSWORD_PATTERN = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{8,}$'
)

def validate_password_complexity(password: str) -> tuple[bool, str]:
    """
    Validate password meets complexity requirements.
    
    Requirements:
    - At least 8 characters
    - At least one lowercase letter
    - At least one uppercase letter  
    - At least one digit
    - At least one special character (@$!%*?&_-#)
    
    Returns:
        tuple: (is_valid: bool, error_message: str)
    """
    if len(password) < PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {PASSWORD_MIN_LENGTH} characters long"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    if not re.search(r'[@$!%*?&_\-#]', password):
        return False, "Password must contain at least one special character (@$!%*?&_-#)"
    
    return True, ""


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
    return current_user


def require_role(required_roles: List[UserRole]):
    """
    Factoría de dependencias que crea una dependencia para requerir uno o más roles.
    """
    async def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have enough permissions to perform this action.",
            )
        return current_user
    return role_checker