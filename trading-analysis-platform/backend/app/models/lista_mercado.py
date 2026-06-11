"""ListaMercado -> dbo.C062 (snapshots de listas de market movers).

Nombre documental: C062-ListasMercado. Nombre fisico SQL: C062.
TipoLista: TRENDING | TOP_GAINERS | TOP_LOSERS | MOST_ACTIVE.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Integer, String, UnicodeText

from app.database import Base


class ListaMercado(Base):
    __tablename__ = "C062"
    __table_args__ = {"schema": "dbo"}

    C062Id = Column(Integer, primary_key=True, index=True)  # IDENTITY(1,1)
    TipoLista = Column(String(50), nullable=False)
    Proveedor = Column(String(50), nullable=False)
    FechaObtencion = Column(DateTime, nullable=False)
    RawJSON = Column(UnicodeText, nullable=True)
    Activo = Column(Boolean, nullable=False, default=True)
