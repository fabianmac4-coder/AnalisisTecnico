"""Repositorio SQL de usuarios (dbo.C005)."""
from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import (
    AnalisisDibujo,
    CatalogoUsuarioAccion,
    ChatConversacion,
    ChatMensaje,
    ConfiguracionScorecard,
    IndicadorConfiguracion,
    LayoutGrafica,
    OperacionSimulada,
    PasswordToken,
    PosicionPortafolio,
    Portafolio,
    Usuario,
)
from app.repositories.sql_utils import next_id, utcnow


def normalize_username(username: str) -> str:
    """Igual que la columna calculada de SQL Server: UPPER(TRIM(...))."""
    return username.strip().upper()


def normalize_email(email: str) -> str:
    return email.strip().lower()


class UsersRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: int) -> Usuario | None:
        return self.db.get(Usuario, user_id)

    def get_by_username_normalizado(self, username: str) -> Usuario | None:
        normalized = normalize_username(username)
        # NombreNormalizado es columna calculada UPPER(TRIM(NombreUsuario)).
        return self.db.execute(
            select(Usuario).where(
                func.upper(func.trim(Usuario.NombreUsuario)) == normalized
            )
        ).scalar_one_or_none()

    def get_by_email(self, email: str) -> Usuario | None:
        return self.db.execute(
            select(Usuario).where(func.lower(Usuario.Email) == normalize_email(email))
        ).scalar_one_or_none()

    def list_users(self) -> list[Usuario]:
        return list(
            self.db.execute(select(Usuario).order_by(Usuario.C005Id)).scalars()
        )

    def create_user(
        self,
        nombre_usuario: str,
        email: str,
        password_hash: str,
        es_admin: bool = False,
        debe_cambiar_password: bool = True,
    ) -> Usuario:
        now = utcnow()
        user = Usuario(
            C005Id=next_id(self.db, Usuario.C005Id),
            NombreUsuario=nombre_usuario.strip(),
            Email=normalize_email(email),
            PasswordHash=password_hash,
            Activo=True,
            EsAdmin=es_admin,
            DebeCambiarPassword=debe_cambiar_password,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def update_user(self, user: Usuario, **changes) -> Usuario:
        for key, value in changes.items():
            setattr(user, key, value)
        user.FechaActualizacion = utcnow()
        self.db.flush()
        return user

    def reset_password(self, user: Usuario, password_hash: str) -> Usuario:
        user.PasswordHash = password_hash
        user.DebeCambiarPassword = False
        user.FechaActualizacion = utcnow()
        self.db.flush()
        return user

    def deactivate_user(self, user: Usuario) -> Usuario:
        user.Activo = False
        user.FechaDesactivacion = utcnow()
        user.FechaActualizacion = utcnow()
        self.db.flush()
        return user

    def hard_delete_user(self, user: Usuario) -> None:
        """Borrado FISICO del usuario y de todos sus registros hijos.

        Excepcion deliberada a la regla de soft-delete: solo para usuarios de
        prueba, via el endpoint admin hard-delete (con guardas). El orden
        importa (hijos antes que C005). No hace commit: el caller decide la
        transaccion completa (rollback si algo falla).
        """
        user_id = user.C005Id
        # 1) Mensajes de IA (C111) de las conversaciones del usuario.
        user_conversations = select(ChatConversacion.C110Id).where(
            ChatConversacion.C005Id == user_id
        )
        self.db.execute(
            delete(ChatMensaje).where(ChatMensaje.C110Id.in_(user_conversations))
        )
        # 2) Conversaciones de IA (C110) y demas tablas hijas. C091 (posiciones)
        #    antes que C090 (portafolios) por la FK; ambas antes que C005.
        for model in (
            ChatConversacion,
            ConfiguracionScorecard,
            PosicionPortafolio,
            Portafolio,
            OperacionSimulada,
            PasswordToken,
            AnalisisDibujo,
            IndicadorConfiguracion,
            LayoutGrafica,
            CatalogoUsuarioAccion,
        ):
            self.db.execute(delete(model).where(model.C005Id == user_id))
        self.db.delete(user)
        self.db.flush()

    def count_active_admins(self) -> int:
        return int(
            self.db.execute(
                select(func.count())
                .select_from(Usuario)
                .where(Usuario.Activo == True, Usuario.EsAdmin == True)  # noqa: E712
            ).scalar()
            or 0
        )

    def touch_last_access(self, user: Usuario) -> None:
        user.UltimoAcceso = utcnow()
        self.db.flush()
