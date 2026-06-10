"""CatalogoUsuarioAccion -> dbo.C040 (watchlist por usuario, sin IDENTITY).

Unico por (C005Id, C010Id) — indice UQ_C040_UsuarioAccion.
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


class CatalogoUsuarioAccion(Base):
    __tablename__ = "C040"
    __table_args__ = {"schema": "dbo"}

    C040Id = Column(Integer, primary_key=True, autoincrement=False)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    C010Id = Column(Integer, ForeignKey("dbo.C010.C010Id"), nullable=False)
    Favorito = Column(Boolean, nullable=False, default=False)
    TagsJSON = Column(UnicodeText, nullable=True)
    UltimaConsulta = Column(DateTime, nullable=True)
    Notas = Column(String(500), nullable=True)
    Activo = Column(Boolean, nullable=False, default=True)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
