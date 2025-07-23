# backend/api/endpoints/auth.py

from fastapi import APIRouter, Depends, HTTPException, status
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
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], 
    db: Session = Depends(get_db)
):
    """
    Endpoint de login. Recibe username y password, devuelve un token JWT.
    """
    # 1. Buscamos al usuario en la BBDD
    user = db.query(User).filter(User.username == form_data.username).first()

    # 2. Verificamos que el usuario exista y que la contraseña sea correcta
    if not user or not auth_service.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Creamos el token de acceso
    access_token = auth_service.create_access_token(
        data={"sub": user.username, "role": user.role.value}
    )

    # 4. Devolvemos el token
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users/me", response_model=UserResponse)
async def read_users_me(
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)]
):
    """
    Endpoint protegido que devuelve la información del usuario logueado.
    """
    return current_user