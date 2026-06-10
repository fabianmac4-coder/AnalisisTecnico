"""Usuario -> dbo.C005 (esquema real, sin IDENTITY)."""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Computed, DateTime, Integer, String

from app.database import Base


class Usuario(Base):
    __tablename__ = "C005"
    __table_args__ = {"schema": "dbo"}

    C005Id = Column(Integer, primary_key=True, autoincrement=False)
    NombreUsuario = Column(String(200), nullable=False)
    PasswordHash = Column(String(255), nullable=False)
    # En la tabla real Email es NOT NULL.
    Email = Column(String(200), nullable=False)
    Activo = Column(Boolean, nullable=False, default=True)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
    # Columna CALCULADA persistida: UPPER(TRIM(NombreUsuario)). Nunca escribir.
    NombreNormalizado = Column(
        String(200), Computed("UPPER(TRIM(NombreUsuario))", persisted=True)
    )

    # Campos agregados por sql/001_auth_fields_and_indexes.sql
    EsAdmin = Column(Boolean, nullable=False, default=False)
    DebeCambiarPassword = Column(Boolean, nullable=False, default=True)
    UltimoAcceso = Column(DateTime, nullable=True)
    FechaDesactivacion = Column(DateTime, nullable=True)
