"""LayoutGrafica -> dbo.C030 (sin IDENTITY). Un layout default por usuario."""
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


class LayoutGrafica(Base):
    __tablename__ = "C030"
    __table_args__ = {"schema": "dbo"}

    C030Id = Column(Integer, primary_key=True, autoincrement=False)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    NombreLayout = Column(String(200), nullable=False)
    EsDefault = Column(Boolean, nullable=False, default=True)
    ConfiguracionJSON = Column(UnicodeText, nullable=False)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
