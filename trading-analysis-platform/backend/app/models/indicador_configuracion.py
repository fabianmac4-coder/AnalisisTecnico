"""IndicadorConfiguracion -> dbo.C020 (sin IDENTITY).

C010Id NULL = configuracion GLOBAL del usuario; con valor = por instrumento.
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


class IndicadorConfiguracion(Base):
    __tablename__ = "C020"
    __table_args__ = {"schema": "dbo"}

    C020Id = Column(Integer, primary_key=True, autoincrement=False)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    C010Id = Column(Integer, ForeignKey("dbo.C010.C010Id"), nullable=True)
    TipoIndicador = Column(String(50), nullable=False)
    NombreIndicador = Column(String(200), nullable=False)
    Visible = Column(Boolean, nullable=False, default=False)
    AplicarTodasTemporalidades = Column(Boolean, nullable=False, default=True)
    ParametrosJSON = Column(UnicodeText, nullable=False)
    EstiloJSON = Column(UnicodeText, nullable=True)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
