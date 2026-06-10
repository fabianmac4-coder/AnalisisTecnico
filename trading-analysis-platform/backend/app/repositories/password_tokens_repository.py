"""Repositorio SQL de tokens de set/reset password (dbo.C006)."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PasswordToken
from app.repositories.sql_utils import utcnow


class PasswordTokensRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_token(
        self, user_id: int, token_hash: str, tipo_token: str, expires_hours: int
    ) -> PasswordToken:
        token = PasswordToken(
            C005Id=user_id,
            TokenHash=token_hash,
            TipoToken=tipo_token,
            Usado=False,
            FechaExpiracion=utcnow() + timedelta(hours=expires_hours),
            FechaCreacion=utcnow(),
        )
        self.db.add(token)
        self.db.flush()
        return token

    def get_valid_token_by_hash(self, token_hash: str) -> PasswordToken | None:
        """Token existente, no usado y no expirado; None en caso contrario."""
        token = self.db.execute(
            select(PasswordToken).where(PasswordToken.TokenHash == token_hash)
        ).scalar_one_or_none()
        if token is None:
            return None
        if token.Usado:
            return None
        if token.FechaExpiracion < utcnow():
            return None
        return token

    def mark_used(self, token: PasswordToken) -> None:
        token.Usado = True
        token.FechaUso = utcnow()
        self.db.flush()
