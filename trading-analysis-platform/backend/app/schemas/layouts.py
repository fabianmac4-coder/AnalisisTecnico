"""Schemas de layouts de graficas."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChartLayout(BaseModel):
    id: str = "default"
    name: str = "Default"
    isDefault: bool = True
    # layout_json libre: el frontend decide su forma exacta.
    layout: dict[str, Any] = Field(default_factory=dict)
