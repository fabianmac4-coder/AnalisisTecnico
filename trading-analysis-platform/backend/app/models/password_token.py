"""PasswordToken -> dbo.C006 (creada por sql/002, UNICA tabla con IDENTITY).

Solo se almacena el HASH del token; el token crudo viaja unicamente en el
link del correo. TipoToken: SET_PASSWORD | RESET_PASSWORD.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String

from app.database import Base


class PasswordToken(Base):
    __tablename__ = "C006"
    __table_args__ = {"schema": "dbo"}

    C006Id = Column(Integer, primary_key=True, autoincrement=True)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    TokenHash = Column(String(255), nullable=False)
    TipoToken = Column(String(50), nullable=False)
    Usado = Column(Boolean, nullable=False, default=False)
    FechaExpiracion = Column(DateTime, nullable=False)
    FechaUso = Column(DateTime, nullable=True)
    FechaCreacion = Column(DateTime, nullable=False)
