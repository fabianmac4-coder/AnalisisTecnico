"""Schemas de dibujos: forma EXACTA que consume el frontend.

Coordenadas SIEMPRE en tiempo(ms)/precio reales. El backend traduce esta forma
a/desde filas de dbo.C0101 (ver routers/drawings.py).
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DrawingType = Literal[
    "free_line",
    "dotted_line",
    "extended_trendline",
    "rectangle",
    "ellipse",
    "horizontal",
    "vertical",
    "ray",
    "trendline",
    "parallel_channel",
    "text",
    # Cajas de planificación riesgo/recompensa (tipo TradingView). La geometría
    # (3 puntos: entry/target/stop) va en PuntosJSON; los datos extra (cantidad,
    # fees, notas, contexto de gráfica) en EstiloJSON.position.
    "LONG_POSITION",
    "SHORT_POSITION",
]
# Antes era un Literal de los seis presets; ahora es libre porque los slots de
# workspace usan contextKeys dinamicos (ej. "1Y_1h", "6M_15m").
SourceTimeframe = str
LineStyle = Literal["solid", "dashed", "dotted"]


class DrawingPoint(BaseModel):
    time: float  # Unix ms
    price: float


class DrawingStyle(BaseModel):
    color: str = "#3b82f6"
    width: int = 2
    lineStyle: LineStyle = "solid"
    opacity: float = 1.0
    fillOpacity: float | None = None
    label: str | None = None
    extendLeft: bool | None = False
    extendRight: bool | None = False
    usesTimeframeDefaultColor: bool | None = True
    # Slot dueño (chart_1..chart_6); identidad de visibilidad en el frontend.
    chartSlotId: str | None = None
    # Datos NO geométricos de las cajas de posición (LONG/SHORT): cantidad, fees,
    # notas, moneda y contexto de la gráfica. Passthrough opaco (round-trip por
    # EstiloJSON). None para todos los demás tipos de dibujo.
    position: dict | None = None


class DrawingIn(BaseModel):
    """Payload de creacion/actualizacion desde el frontend."""

    id: str | None = None  # numerico => update; uuid/None => create
    symbol: str = Field(min_length=1)
    # Workspace de analisis (C030). Requerido al CREAR; el handler lo valida.
    c030Id: int | None = None
    sourceTimeframe: SourceTimeframe
    type: DrawingType
    points: list[DrawingPoint] = Field(default_factory=list)
    style: DrawingStyle = Field(default_factory=DrawingStyle)
    visible: bool = True
    locked: bool = False
    showOnAllTimeframes: bool = True
    showOnTimeframes: list[str] | None = None
    version: int = 3


class DrawingOut(BaseModel):
    id: str  # str(C0101Id)
    symbol: str
    c030Id: int | None = None
    sourceTimeframe: str
    type: str
    points: list[DrawingPoint]
    style: DrawingStyle
    visible: bool
    locked: bool
    showOnAllTimeframes: bool
    showOnTimeframes: list[str] | None = None
    createdAt: str
    updatedAt: str
    version: int
