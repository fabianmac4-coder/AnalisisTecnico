"""Endpoints de autenticacion: login, me, validacion y set de password."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import env_settings
from app.database import get_db
from app.models import Usuario
from app.repositories.password_tokens_repository import PasswordTokensRepository
from app.repositories.users_repository import UsersRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    MeResponse,
    SetPasswordRequest,
    SetPasswordResponse,
    UpdateMeRequest,
    UserPublic,
    ValidateTokenResponse,
)
from app.security.dependencies import get_current_active_user
from app.security.jwt import create_access_token
from app.security.password import hash_password, validate_password_strength, verify_password
from app.security.tokens import (
    RESET_PASSWORD_EXPIRE_HOURS,
    TOKEN_TYPE_RESET,
    TOKEN_TYPE_SET,
    generate_raw_token,
    hash_token,
)
from app.services import email_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _mask_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    local, domain = email.split("@", 1)
    visible = local[0] if local else ""
    return f"{visible}***@{domain}"


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    users = UsersRepository(db)
    candidate = payload.username.strip()

    # Acepta login por Email o por NombreUsuario (normalizado).
    user: Usuario | None = None
    if "@" in candidate:
        user = users.get_by_email(candidate)
    if user is None:
        user = users.get_by_username_normalizado(candidate)

    if user is None or not verify_password(payload.password, user.PasswordHash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not user.Activo:
        raise HTTPException(status_code=403, detail="Usuario desactivado")
    # DebeCambiarPassword=1 NO bloquea el login: se emite el JWT y el frontend
    # fuerza /change-password antes de dejar entrar al dashboard.

    users.touch_last_access(user)
    db.commit()

    token = create_access_token(
        {
            "sub": str(user.C005Id),
            "username": user.NombreUsuario,
            "is_admin": bool(user.EsAdmin),
        }
    )
    return LoginResponse(
        accessToken=token,
        user=UserPublic(
            id=user.C005Id,
            nombreUsuario=user.NombreUsuario,
            email=user.Email,
            esAdmin=bool(user.EsAdmin),
            debeCambiarPassword=bool(user.DebeCambiarPassword),
        ),
    )


def _me_response(user: Usuario) -> MeResponse:
    return MeResponse(
        id=user.C005Id,
        nombreUsuario=user.NombreUsuario,
        email=user.Email,
        esAdmin=bool(user.EsAdmin),
        activo=bool(user.Activo),
        debeCambiarPassword=bool(user.DebeCambiarPassword),
    )


@router.get("/me", response_model=MeResponse)
def me(user: Usuario = Depends(get_current_active_user)) -> MeResponse:
    return _me_response(user)


@router.patch("/me", response_model=MeResponse)
def update_me(
    payload: UpdateMeRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> MeResponse:
    """Edita SOLO el perfil propio (nombre/email). Jamás EsAdmin ni Activo."""
    users = UsersRepository(db)
    changes: dict = {}

    if payload.nombreUsuario is not None:
        other = users.get_by_username_normalizado(payload.nombreUsuario)
        if other is not None and other.C005Id != user.C005Id:
            raise HTTPException(status_code=409, detail="Nombre de usuario en uso")
        changes["NombreUsuario"] = payload.nombreUsuario.strip()
    if payload.email is not None:
        other = users.get_by_email(payload.email)
        if other is not None and other.C005Id != user.C005Id:
            raise HTTPException(status_code=409, detail="Email en uso")
        changes["Email"] = payload.email.strip().lower()

    if changes:
        users.update_user(user, **changes)
        db.commit()
    return _me_response(user)


@router.post("/logout")
def logout() -> dict:
    """MVP: el frontend borra su token; no hay estado de sesion en servidor."""
    return {"success": True}


@router.get("/validate-password-token", response_model=ValidateTokenResponse)
def validate_password_token(
    token: str = Query(..., min_length=1), db: Session = Depends(get_db)
) -> ValidateTokenResponse:
    tokens = PasswordTokensRepository(db)
    record = tokens.get_valid_token_by_hash(hash_token(token))
    if record is None:
        return ValidateTokenResponse(valid=False, reason="invalid_or_expired")
    user = UsersRepository(db).get_by_id(record.C005Id)
    return ValidateTokenResponse(
        valid=True,
        tipoToken=record.TipoToken,
        email=_mask_email(user.Email if user else None),
    )


def _consume_token_and_set_password(
    db: Session, raw_token: str, new_password: str
) -> None:
    """Nucleo compartido de set-password y reset-password.

    Valida fuerza, busca el token por hash (no usado, no expirado), exige
    usuario existente y activo, actualiza el hash y marca el token usado.
    """
    error = validate_password_strength(new_password)
    if error:
        raise HTTPException(status_code=400, detail=error)

    tokens = PasswordTokensRepository(db)
    record = tokens.get_valid_token_by_hash(hash_token(raw_token))
    if record is None:
        raise HTTPException(status_code=400, detail="Token inválido, usado o expirado")
    if record.TipoToken not in (TOKEN_TYPE_SET, TOKEN_TYPE_RESET):
        raise HTTPException(status_code=400, detail="Tipo de token inválido")

    users = UsersRepository(db)
    user = users.get_by_id(record.C005Id)
    if user is None:
        raise HTTPException(status_code=400, detail="Usuario no encontrado")
    if not user.Activo:
        raise HTTPException(status_code=403, detail="Usuario desactivado")

    users.reset_password(user, hash_password(new_password))
    tokens.mark_used(record)
    db.commit()


@router.post("/set-password", response_model=SetPasswordResponse)
def set_password(
    payload: SetPasswordRequest, db: Session = Depends(get_db)
) -> SetPasswordResponse:
    _consume_token_and_set_password(db, payload.token, payload.newPassword)
    return SetPasswordResponse(success=True, message="Password set successfully")


@router.post("/reset-password", response_model=SetPasswordResponse)
def reset_password(
    payload: SetPasswordRequest, db: Session = Depends(get_db)
) -> SetPasswordResponse:
    """Igual que set-password; ruta separada para el flujo 'olvidé mi clave'."""
    _consume_token_and_set_password(db, payload.token, payload.newPassword)
    return SetPasswordResponse(success=True, message="Password updated successfully.")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    payload: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> ForgotPasswordResponse:
    """Recuperación desde el login. NUNCA crea usuarios ni tokens fantasma.

    Sistema interno: validación explícita (404 email inexistente, 403
    usuario inactivo) en lugar de respuestas genéricas anti-enumeración.
    """
    users = UsersRepository(db)
    user = users.get_by_email(payload.email)
    if user is None:
        raise HTTPException(
            status_code=404, detail="No active user exists with that email."
        )
    if not user.Activo:
        raise HTTPException(
            status_code=403,
            detail="This user is inactive. Contact the administrator.",
        )

    raw = generate_raw_token()
    PasswordTokensRepository(db).create_token(
        user.C005Id, hash_token(raw), TOKEN_TYPE_RESET, RESET_PASSWORD_EXPIRE_HOURS
    )
    link = f"{env_settings.FRONTEND_URL}/reset-password?token={raw}"
    email_service.send_password_reset_email(user.Email, user.NombreUsuario, link)
    db.commit()
    return ForgotPasswordResponse(
        success=True, message="Password recovery email sent."
    )


@router.post("/change-password", response_model=SetPasswordResponse)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> SetPasswordResponse:
    """Cambio de contraseña del usuario autenticado (requiere la actual)."""
    if not verify_password(payload.currentPassword, user.PasswordHash):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta")
    error = validate_password_strength(payload.newPassword)
    if error:
        raise HTTPException(status_code=400, detail=error)
    UsersRepository(db).reset_password(user, hash_password(payload.newPassword))
    db.commit()
    return SetPasswordResponse(success=True, message="Password updated successfully.")
