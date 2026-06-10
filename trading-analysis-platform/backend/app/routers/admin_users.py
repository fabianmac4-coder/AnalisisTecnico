"""Administracion de usuarios (solo admins). NO hay registro publico."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import env_settings
from app.database import get_db
from app.models import Usuario
from app.repositories.password_tokens_repository import PasswordTokensRepository
from app.repositories.users_repository import UsersRepository, normalize_username
from app.schemas.auth import (
    AdminUserCreate,
    AdminUserCreateResponse,
    AdminUserOut,
    AdminUserUpdate,
    HardDeleteResponse,
    SendResetResponse,
    SetTemporaryPasswordRequest,
    SetTemporaryPasswordResponse,
)
from app.security.dependencies import require_admin
from app.security.password import hash_password, validate_password_strength
from app.security.tokens import (
    RESET_PASSWORD_EXPIRE_HOURS,
    SET_PASSWORD_EXPIRE_HOURS,
    TOKEN_TYPE_RESET,
    TOKEN_TYPE_SET,
    generate_raw_token,
    hash_token,
)
from app.services import email_service

router = APIRouter(
    prefix="/admin/users", tags=["admin"], dependencies=[Depends(require_admin)]
)


def _to_out(user: Usuario) -> AdminUserOut:
    return AdminUserOut(
        id=user.C005Id,
        nombreUsuario=user.NombreUsuario,
        email=user.Email,
        activo=bool(user.Activo),
        esAdmin=bool(user.EsAdmin),
        debeCambiarPassword=bool(user.DebeCambiarPassword),
        fechaCreacion=user.FechaCreacion.isoformat() if user.FechaCreacion else None,
        ultimoAcceso=user.UltimoAcceso.isoformat() if user.UltimoAcceso else None,
    )


def _create_password_token_and_send(
    db: Session, user: Usuario, tipo: str
) -> bool:
    """Genera token, guarda SOLO el hash y envia el correo. Devuelve si se envio."""
    raw = generate_raw_token()
    hours = SET_PASSWORD_EXPIRE_HOURS if tipo == TOKEN_TYPE_SET else RESET_PASSWORD_EXPIRE_HOURS
    PasswordTokensRepository(db).create_token(user.C005Id, hash_token(raw), tipo, hours)
    link = f"{env_settings.FRONTEND_URL}/set-password?token={raw}"
    if tipo == TOKEN_TYPE_SET:
        return email_service.send_password_setup_email(user.Email, user.NombreUsuario, link)
    return email_service.send_password_reset_email(user.Email, user.NombreUsuario, link)


@router.get("", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db)) -> list[AdminUserOut]:
    return [_to_out(u) for u in UsersRepository(db).list_users()]


@router.post("", response_model=AdminUserCreateResponse, status_code=201)
def create_user(
    payload: AdminUserCreate, db: Session = Depends(get_db)
) -> AdminUserCreateResponse:
    users = UsersRepository(db)

    if users.get_by_username_normalizado(payload.nombreUsuario) is not None:
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese nombre")
    if users.get_by_email(payload.email) is not None:
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese email")

    # Password inutilizable hasta que el usuario la defina via link de correo.
    unusable = hash_password(generate_raw_token())
    user = users.create_user(
        nombre_usuario=payload.nombreUsuario,
        email=payload.email,
        password_hash=unusable,
        es_admin=payload.esAdmin,
        debe_cambiar_password=True,
    )
    email_sent = _create_password_token_and_send(db, user, TOKEN_TYPE_SET)
    db.commit()

    return AdminUserCreateResponse(**_to_out(user).model_dump(), setupEmailSent=email_sent)


@router.patch("/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int, payload: AdminUserUpdate, db: Session = Depends(get_db)
) -> AdminUserOut:
    users = UsersRepository(db)
    user = users.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    changes: dict = {}
    if payload.nombreUsuario is not None:
        other = users.get_by_username_normalizado(payload.nombreUsuario)
        if other is not None and other.C005Id != user_id:
            raise HTTPException(status_code=409, detail="Nombre de usuario en uso")
        if normalize_username(payload.nombreUsuario) != (user.NombreNormalizado or ""):
            changes["NombreUsuario"] = payload.nombreUsuario.strip()
    if payload.email is not None:
        other = users.get_by_email(payload.email)
        if other is not None and other.C005Id != user_id:
            raise HTTPException(status_code=409, detail="Email en uso")
        changes["Email"] = payload.email.strip().lower()

    # Protecciones del ultimo admin activo.
    is_last_active_admin = (
        bool(user.EsAdmin) and bool(user.Activo) and users.count_active_admins() <= 1
    )
    if payload.esAdmin is False and is_last_active_admin:
        raise HTTPException(
            status_code=400,
            detail="No se puede quitar permisos al último administrador activo",
        )
    if payload.activo is False and is_last_active_admin:
        raise HTTPException(
            status_code=400, detail="No se puede desactivar al último administrador activo"
        )

    if payload.esAdmin is not None:
        changes["EsAdmin"] = payload.esAdmin
    if payload.activo is not None:
        if payload.activo is False and user.Activo:
            users.deactivate_user(user)
        else:
            changes["Activo"] = payload.activo

    if changes:
        users.update_user(user, **changes)
    db.commit()
    return _to_out(user)


@router.post("/{user_id}/send-password-reset", response_model=SendResetResponse)
def send_password_reset(user_id: int, db: Session = Depends(get_db)) -> SendResetResponse:
    users = UsersRepository(db)
    user = users.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not user.Activo:
        raise HTTPException(
            status_code=400, detail="El usuario está desactivado; actívalo primero"
        )
    email_sent = _create_password_token_and_send(db, user, TOKEN_TYPE_RESET)
    users.update_user(user, DebeCambiarPassword=True)
    db.commit()
    return SendResetResponse(success=True, resetEmailSent=email_sent)


@router.delete("/{user_id}", response_model=AdminUserOut)
def deactivate_user(user_id: int, db: Session = Depends(get_db)) -> AdminUserOut:
    """Soft delete: Activo=0 + FechaDesactivacion (nunca borrado fisico)."""
    users = UsersRepository(db)
    user = users.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if bool(user.EsAdmin) and bool(user.Activo) and users.count_active_admins() <= 1:
        raise HTTPException(
            status_code=400, detail="No se puede desactivar al último administrador activo"
        )
    users.deactivate_user(user)
    db.commit()
    return _to_out(user)


@router.delete("/{user_id}/hard-delete", response_model=HardDeleteResponse)
def hard_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: Usuario = Depends(require_admin),
) -> HardDeleteResponse:
    """Borrado PERMANENTE (usuarios de prueba): hijos primero, luego C005.

    Guardas: no a uno mismo, no al último admin activo. Todo en una sola
    transacción con rollback si algo falla.
    """
    if current.C005Id == user_id:
        raise HTTPException(
            status_code=400,
            detail="No puedes eliminar permanentemente tu propio usuario",
        )

    users = UsersRepository(db)
    user = users.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Si es un admin activo y es el último, el sistema quedaría sin admins.
    if bool(user.EsAdmin) and bool(user.Activo) and users.count_active_admins() <= 1:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar al último administrador activo",
        )

    try:
        users.hard_delete_user(user)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="No se pudo eliminar el usuario; no se aplicó ningún cambio",
        )
    return HardDeleteResponse(success=True, message="User permanently deleted")


@router.post("/{user_id}/set-temporary-password", response_model=SetTemporaryPasswordResponse)
def set_temporary_password(
    user_id: int,
    payload: SetTemporaryPasswordRequest,
    db: Session = Depends(get_db),
) -> SetTemporaryPasswordResponse:
    """Asigna una contraseña temporal (el admin se la comunica al usuario).

    Con requireChange=True (default) deja DebeCambiarPassword=1: el usuario
    puede iniciar sesión con la temporal pero el frontend lo fuerza a
    /change-password antes de entrar. Nunca se envía por correo ni se
    devuelve en la respuesta.
    """
    error = validate_password_strength(payload.temporaryPassword)
    if error:
        raise HTTPException(status_code=400, detail=error)

    users = UsersRepository(db)
    user = users.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    users.update_user(
        user,
        PasswordHash=hash_password(payload.temporaryPassword),
        DebeCambiarPassword=payload.requireChange,
    )
    db.commit()
    return SetTemporaryPasswordResponse(
        success=True, message="Temporary password set successfully"
    )


@router.post("/{user_id}/force-password-change", response_model=SetTemporaryPasswordResponse)
def force_password_change(
    user_id: int, db: Session = Depends(get_db)
) -> SetTemporaryPasswordResponse:
    """Marca DebeCambiarPassword=1: en su siguiente login el usuario deberá
    definir una nueva contraseña antes de entrar al dashboard."""
    users = UsersRepository(db)
    user = users.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    users.update_user(user, DebeCambiarPassword=True)
    db.commit()
    return SetTemporaryPasswordResponse(
        success=True,
        message="User will be required to change password on next login",
    )
