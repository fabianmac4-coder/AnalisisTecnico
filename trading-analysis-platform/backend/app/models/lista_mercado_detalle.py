"""ListaMercadoDetalle -> dbo.C063 (tickers de cada snapshot de movers).

Nombre documental: C063-ListasMercadoDetalle. Nombre fisico SQL: C063.
"""
from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UnicodeText,
)

from app.database import Base


class ListaMercadoDetalle(Base):
    __tablename__ = "C063"
    __table_args__ = {"schema": "dbo"}

    C063Id = Column(Integer, primary_key=True, index=True)  # IDENTITY(1,1)
    C062Id = Column(Integer, ForeignKey("dbo.C062.C062Id"), nullable=False)
    C010Id = Column(Integer, ForeignKey("dbo.C010.C010Id"), nullable=True)
    Ticker = Column(String(30), nullable=False)
    YahooSymbol = Column(String(50), nullable=True)
    NombreInstrumento = Column(String(250), nullable=True)
    Precio = Column(Numeric(18, 6), nullable=True)
    Cambio = Column(Numeric(18, 6), nullable=True)
    CambioPorcentaje = Column(Numeric(18, 6), nullable=True)
    Volumen = Column(BigInteger, nullable=True)
    MarketCap = Column(Numeric(28, 2), nullable=True)
    Ranking = Column(Integer, nullable=True)
    RawJSON = Column(UnicodeText, nullable=True)
    FechaCreacion = Column(DateTime, nullable=False)
