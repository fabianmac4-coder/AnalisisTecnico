"""PreferenciaUsuario -> dbo.C092 (preferencias clave/valor por usuario).

Tabla NUEVA con IDENTITY (como C006/C050/C081). Guarda el valor en ValorJSON.
Primer uso: DEFAULT_CHART_LAYOUT_TEMPLATE. Borrado suave via Activo.
"""
from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UnicodeText,
)

from app.database import Base


class PreferenciaUsuario(Base):
    __tablename__ = "C092"
    __table_args__ = {"schema": "dbo"}

    C092Id = Column(Integer, primary_key=True)  # IDENTITY(1,1)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    ClavePreferencia = Column(String(100), nullable=False)
    ValorJSON = Column(UnicodeText, nullable=False)
    Activo = Column(Boolean, nullable=False, default=True)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
