# backend/schemas/user.py
from pydantic import BaseModel, ConfigDict
from db.models import UserRole

class UserResponse(BaseModel):
    id: int
    username: str
    role: UserRole
    is_active: bool

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)