"""ConfiguracionScorecard -> dbo.C081 (preferencias de puntuacion por usuario).

Tabla NUEVA con IDENTITY (como C006/C050). Guarda pesos/umbrales del Stock
Scorecard en ConfiguracionJSON. Borrado suave via Activo.
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


class ConfiguracionScorecard(Base):
    __tablename__ = "C081"
    __table_args__ = {"schema": "dbo"}

    C081Id = Column(Integer, primary_key=True)  # IDENTITY(1,1)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    NombreConfiguracion = Column(String(200), nullable=False)
    EsDefault = Column(Boolean, nullable=False, default=False)
    ConfiguracionJSON = Column(UnicodeText, nullable=False)
    Activo = Column(Boolean, nullable=False, default=True)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
