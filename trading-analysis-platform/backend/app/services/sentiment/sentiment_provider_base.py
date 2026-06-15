"""Interfaz base de un proveedor de sentimiento de mercado."""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.sentiment.sentiment_types import SentimentInputs, SentimentResult


class SentimentProvider(ABC):
    """Calcula un puntaje de sentimiento 0-100 a partir de insumos de mercado."""

    name: str = "base"

    @abstractmethod
    def compute(self, inputs: SentimentInputs) -> SentimentResult:  # pragma: no cover
        ...
