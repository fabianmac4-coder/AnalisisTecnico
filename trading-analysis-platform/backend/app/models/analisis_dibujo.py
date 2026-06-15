"""AnalisisDibujo -> dbo.C0101 (dibujos por usuario+accion, sin IDENTITY)."""
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


class AnalisisDibujo(Base):
    __tablename__ = "C0101"
    __table_args__ = {"schema": "dbo"}

    C0101Id = Column(Integer, primary_key=True, autoincrement=False)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    C010Id = Column(Integer, ForeignKey("dbo.C010.C010Id"), nullable=False)
    # Workspace de analisis (dbo.C030). NULL = dibujo heredado (pre-workspaces),
    # visible solo en el workspace por defecto de la accion.
    C030Id = Column(Integer, ForeignKey("dbo.C030.C030Id"), nullable=True)
    TipoDibujo = Column(String(50), nullable=False)
    TemporalidadOrigen = Column(String(50), nullable=False)
    NombreAnalisis = Column(String(200), nullable=True)
    PuntosJSON = Column(UnicodeText, nullable=False)
    EstiloJSON = Column(UnicodeText, nullable=False)
    Visible = Column(Boolean, nullable=False, default=True)
    Bloqueado = Column(Boolean, nullable=False, default=False)
    MostrarEnTodasTemporalidades = Column(Boolean, nullable=False, default=True)
    TemporalidadesVisiblesJSON = Column(UnicodeText, nullable=True)
    Comentario = Column(String(500), nullable=True)
    Version = Column(Integer, nullable=False, default=3)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
    Eliminado = Column(Boolean, nullable=False, default=False)
