"""Schemas de layouts y workspaces de analisis (dbo.C030)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChartLayout(BaseModel):
    """Layout global heredado (preferencias de UI, C010Id NULL)."""

    id: str = "default"
    name: str = "Default"
    isDefault: bool = True
    # layout_json libre: el frontend decide su forma exacta.
    layout: dict[str, Any] = Field(default_factory=dict)


# --- Workspaces de analisis por accion ---------------------------------------
class ChartSlotConfig(BaseModel):
    slotId: str = Field(min_length=1, max_length=40)
    range: str = Field(min_length=1, max_length=10)
    interval: str = Field(min_length=1, max_length=10)
    label: str | None = Field(default=None, max_length=80)


class WorkspaceOut(BaseModel):
    c030Id: int
    name: str
    isDefault: bool
    symbol: str
    c010Id: int
    chartSlots: list[ChartSlotConfig] = Field(default_factory=list)
    configuration: dict[str, Any] = Field(default_factory=dict)
    createdAt: str | None = None
    updatedAt: str | None = None


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    copyFromC030Id: int | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    isDefault: bool | None = None
    chartSlots: list[ChartSlotConfig] | None = None
    # Permite parchear ajustes de panel u otros campos sueltos del JSON.
    configuration: dict[str, Any] | None = None


class ChartSlotsUpdate(BaseModel):
    chartSlots: list[ChartSlotConfig] = Field(min_length=1)
