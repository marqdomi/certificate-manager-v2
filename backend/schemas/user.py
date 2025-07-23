# backend/schemas/user.py
from pydantic import BaseModel
from db.models import UserRole

class UserResponse(BaseModel):
    id: int
    username: str
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True