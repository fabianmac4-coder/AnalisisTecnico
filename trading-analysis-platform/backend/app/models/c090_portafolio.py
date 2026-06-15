"""Portafolio -> dbo.C090 (portafolios del usuario).

Tabla NUEVA con IDENTITY. Borrado suave via Activo. Acotada por C005Id.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String

from app.database import Base


class Portafolio(Base):
    __tablename__ = "C090"
    __table_args__ = {"schema": "dbo"}

    C090Id = Column(Integer, primary_key=True)  # IDENTITY(1,1)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    NombrePortafolio = Column(String(200), nullable=False)
    Descripcion = Column(String(1000), nullable=True)
    MonedaBase = Column(String(10), nullable=False, default="USD")
    EsDefault = Column(Boolean, nullable=False, default=False)
    Activo = Column(Boolean, nullable=False, default=True)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
