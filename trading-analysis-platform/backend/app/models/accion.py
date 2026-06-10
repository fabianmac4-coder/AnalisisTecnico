"""Accion (instrumento) -> dbo.C010 (esquema real, sin IDENTITY)."""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Computed, DateTime, Integer, String

from app.database import Base


class Accion(Base):
    __tablename__ = "C010"
    __table_args__ = {"schema": "dbo"}

    C010Id = Column(Integer, primary_key=True, autoincrement=False)
    Ticker = Column(String(50), nullable=False)
    NombreInstrumento = Column(String(250), nullable=True)
    TipoInstrumento = Column(String(50), nullable=False)
    Exchange = Column(String(50), nullable=True)
    Moneda = Column(String(50), nullable=True)
    Pais = Column(String(200), nullable=True)
    Sector = Column(String(200), nullable=True)
    Industria = Column(String(200), nullable=True)
    FuenteDatos = Column(String(200), nullable=False)
    TimezoneMercado = Column(String(200), nullable=True)
    Activo = Column(Boolean, nullable=False, default=True)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
    # En la tabla real YahooSymbol es NOT NULL: es el simbolo usado en yfinance.
    YahooSymbol = Column(String(50), nullable=False)
    # Columna CALCULADA persistida: UPPER(TRIM(Ticker)). Nunca escribir.
    TickerNormalizado = Column(
        String(50), Computed("UPPER(TRIM(Ticker))", persisted=True)
    )
