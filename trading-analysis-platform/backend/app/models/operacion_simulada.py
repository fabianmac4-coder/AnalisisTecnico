"""OperacionSimulada -> dbo.C050 (entradas simuladas / paper trading).

Nombre documental: C050-OperacionesSimuladas. Nombre fisico SQL: C050.
NO es ejecucion real de ordenes: solo seguimiento hipotetico personal.
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
    UnicodeText,
)

from app.database import Base


class OperacionSimulada(Base):
    __tablename__ = "C050"
    __table_args__ = {"schema": "dbo"}

    C050Id = Column(Integer, primary_key=True, index=True)  # IDENTITY(1,1)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    C010Id = Column(Integer, ForeignKey("dbo.C010.C010Id"), nullable=False)
    # Workspace de analisis activo al crear la entrada (NULL = heredada).
    C030Id = Column(Integer, ForeignKey("dbo.C030.C030Id"), nullable=True)
    TipoOperacion = Column(String(30), nullable=False)  # LONG | SHORT
    PrecioEntrada = Column(Numeric(18, 6), nullable=False)
    Cantidad = Column(Numeric(18, 6), nullable=True)
    FechaEntrada = Column(DateTime, nullable=False)
    TemporalidadOrigen = Column(String(30), nullable=True)
    NombreOperacion = Column(String(200), nullable=True)
    Notas = Column(String(1000), nullable=True)
    Estado = Column(String(30), nullable=False)  # ABIERTA | CERRADA
    PrecioSalida = Column(Numeric(18, 6), nullable=True)
    FechaSalida = Column(DateTime, nullable=True)
    MotivoSalida = Column(String(500), nullable=True)
    Color = Column(String(30), nullable=True)
    Visible = Column(Boolean, nullable=False, default=True)
    Activo = Column(Boolean, nullable=False, default=True)
    # Contexto del clic/vela/gráfica al crear (JSON).
    MetadataJSON = Column(UnicodeText, nullable=True)
    # Snapshot de análisis al crear (scorecard/técnico/canal R/R/tesis, JSON).
    AnalisisJSON = Column(UnicodeText, nullable=True)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)
