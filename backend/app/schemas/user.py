from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


# --- Auth Schemas ---
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    email_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
