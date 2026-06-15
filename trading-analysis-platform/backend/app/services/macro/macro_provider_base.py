"""Interfaz base de un proveedor de indicadores macro de EE.UU."""
from __future__ import annotations

from abc import ABC, abstractmethod


class MacroIndicatorProvider(ABC):
    """Devuelve indicadores macro de EE.UU. como dict[key -> indicador]."""

    name: str = "base"

    @abstractmethod
    def available(self) -> bool:  # pragma: no cover - trivial
        """True si el proveedor está configurado (p. ej. tiene API key)."""
        ...

    @abstractmethod
    def fetch_indicators(self) -> tuple[dict, list[str]]:
        """(indicadores, warnings). Best-effort; nunca lanza."""
        ...
