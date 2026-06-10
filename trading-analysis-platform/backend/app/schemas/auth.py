"""Schemas de autenticacion y administracion de usuarios.

PasswordHash NUNCA aparece en ningun schema de salida.
"""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)  # Email o NombreUsuario
    password: str = Field(min_length=1)


class UserPublic(BaseModel):
    id: int
    nombreUsuario: str
    email: str | None = None
    esAdmin: bool
    debeCambiarPassword: bool


class LoginResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    user: UserPublic


class MeResponse(BaseModel):
    id: int
    nombreUsuario: str
    email: str | None = None
    esAdmin: bool
    activo: bool
    debeCambiarPassword: bool


class ValidateTokenResponse(BaseModel):
    valid: bool
    tipoToken: str | None = None
    email: str | None = None  # enmascarado
    reason: str | None = None  # "invalid_or_expired" si valid=False


class SetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    newPassword: str = Field(min_length=1)


class SetPasswordResponse(BaseModel):
    success: bool
    message: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str


class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=1)


class UpdateMeRequest(BaseModel):
    """Perfil propio: SOLO nombre y email. Nunca EsAdmin/Activo/PasswordHash."""

    nombreUsuario: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None


# ===== Admin =====


class AdminUserOut(BaseModel):
    id: int
    nombreUsuario: str
    email: str | None = None
    activo: bool
    esAdmin: bool
    debeCambiarPassword: bool
    fechaCreacion: str | None = None
    ultimoAcceso: str | None = None


class AdminUserCreate(BaseModel):
    nombreUsuario: str = Field(min_length=1, max_length=200)
    email: EmailStr
    esAdmin: bool = False


class AdminUserCreateResponse(AdminUserOut):
    setupEmailSent: bool


class AdminUserUpdate(BaseModel):
    nombreUsuario: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    esAdmin: bool | None = None
    activo: bool | None = None


class SendResetResponse(BaseModel):
    success: bool
    resetEmailSent: bool


class SetTemporaryPasswordRequest(BaseModel):
    temporaryPassword: str = Field(min_length=1)
    # True => el usuario debe cambiarla en su siguiente login (/change-password).
    requireChange: bool = True


class SetTemporaryPasswordResponse(BaseModel):
    success: bool
    message: str


class HardDeleteResponse(BaseModel):
    success: bool
    message: str
