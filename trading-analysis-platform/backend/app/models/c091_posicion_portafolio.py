"""PosicionPortafolio -> dbo.C091 (posiciones/holdings de un portafolio).

Tabla NUEVA con IDENTITY. C005Id se guarda aquí (además de C090Id) para acotar
por usuario sin join y evitar accesos cruzados. Borrado suave via Activo.
"""
from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)

from app.database import Base


class PosicionPortafolio(Base):
    __tablename__ = "C091"
    __table_args__ = {"schema": "dbo"}

    C091Id = Column(Integer, primary_key=True)  # IDENTITY(1,1)
    C090Id = Column(Integer, ForeignKey("dbo.C090.C090Id"), nullable=False)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    C010Id = Column(Integer, ForeignKey("dbo.C010.C010Id"), nullable=True)
    Ticker = Column(String(30), nullable=False)
    YahooSymbol = Column(String(50), nullable=True)
    NombreInstrumento = Column(String(250), nullable=True)
    TipoInstrumento = Column(String(50), nullable=False, default="STOCK")
    Cantidad = Column(Numeric(18, 6), nullable=False)
    PrecioCompraPromedio = Column(Numeric(18, 6), nullable=False)
    FechaCompra = Column(DateTime, nullable=True)
    Moneda = Column(String(10), nullable=True)
    Sector = Column(String(150), nullable=True)
    Industria = Column(String(150), nullable=True)
    Notas = Column(String(1000), nullable=True)
    Activo = Column(Boolean, nullable=False, default=True)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
