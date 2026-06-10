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
]
SourceTimeframe = Literal["4Y_1W", "1Y_1D", "6M_1D", "3M_1D", "1M_1H", "1W_30M"]
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


class DrawingIn(BaseModel):
    """Payload de creacion/actualizacion desde el frontend."""

    id: str | None = None  # numerico => update; uuid/None => create
    symbol: str = Field(min_length=1)
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
