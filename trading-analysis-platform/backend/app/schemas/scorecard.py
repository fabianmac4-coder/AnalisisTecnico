"""Schemas de configuracion del Stock Scorecard (dbo.C081)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ScorecardConfigOut(BaseModel):
    c081Id: int
    name: str
    isDefault: bool
    configuration: dict[str, Any]
    createdAt: str | None = None
    updatedAt: str | None = None


class ScorecardConfigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    configuration: dict[str, Any] | None = None
    copyFromC081Id: int | None = None


class ScorecardConfigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    configuration: dict[str, Any] | None = None
