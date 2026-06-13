"""LayoutGrafica -> dbo.C030 (sin IDENTITY).

Cada fila es un *workspace* de analisis. Layouts globales heredados tienen
C010Id NULL; los workspaces por accion fijan C010Id. Activo permite borrado
suave (un workspace no se borra fisico para no tocar datos relacionados).
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


class LayoutGrafica(Base):
    __tablename__ = "C030"
    __table_args__ = {"schema": "dbo"}

    C030Id = Column(Integer, primary_key=True, autoincrement=False)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    # NULL = layout global heredado; fijo = workspace por accion.
    C010Id = Column(Integer, ForeignKey("dbo.C010.C010Id"), nullable=True)
    NombreLayout = Column(String(200), nullable=False)
    EsDefault = Column(Boolean, nullable=False, default=True)
    ConfiguracionJSON = Column(UnicodeText, nullable=False)
    Activo = Column(Boolean, nullable=False, default=True)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
