"""NoticiaInstrumento -> dbo.C061 (relacion noticia <-> accion).

Nombre documental: C061-NoticiasInstrumentos. Nombre fisico SQL: C061.
"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric

from app.database import Base


class NoticiaInstrumento(Base):
    __tablename__ = "C061"
    __table_args__ = {"schema": "dbo"}

    C061Id = Column(Integer, primary_key=True, index=True)  # IDENTITY(1,1)
    C060Id = Column(Integer, ForeignKey("dbo.C060.C060Id"), nullable=False)
    C010Id = Column(Integer, ForeignKey("dbo.C010.C010Id"), nullable=False)
    Relevancia = Column(Numeric(10, 4), nullable=True)
    FechaCreacion = Column(DateTime, nullable=False)
