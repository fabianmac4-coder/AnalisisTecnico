"""MarketCache -> dbo.C080 (cache de inteligencia de mercado y sentimiento).

Nombre documental: C080-MacroMarketCache. Nombre fisico SQL: C080.
TipoDato: MARKET_INTELLIGENCE_OVERVIEW | MARKET_SENTIMENT | etc.
NO almacena datos de usuario ni secretos: solo respuestas agregadas/publicas.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Integer, String, UnicodeText

from app.database import Base


class MarketCache(Base):
    __tablename__ = "C080"
    __table_args__ = {"schema": "dbo"}

    C080Id = Column(Integer, primary_key=True, index=True)  # IDENTITY(1,1)
    TipoDato = Column(String(100), nullable=False)
    Proveedor = Column(String(100), nullable=False)
    Clave = Column(String(200), nullable=False)
    DataJSON = Column(UnicodeText, nullable=False)
    FechaObtencion = Column(DateTime, nullable=False)
    FechaExpiracion = Column(DateTime, nullable=False)
    Activo = Column(Boolean, nullable=False, default=True)
