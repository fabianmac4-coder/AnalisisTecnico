"""Tipos del servicio de sentimiento de mercado."""
from __future__ import annotations

from dataclasses import dataclass, field

# Etiquetas del puntaje 0-100 (banda -> enum). El display en español lo hace el
# frontend; aquí se devuelve el enum estable.
SENTIMENT_LABELS = (
    (0, 24, "EXTREME_FEAR"),
    (25, 44, "FEAR"),
    (45, 55, "NEUTRAL"),
    (56, 75, "GREED"),
    (76, 100, "EXTREME_GREED"),
)

POSITIVE = "POSITIVE"
NEUTRAL = "NEUTRAL"
NEGATIVE = "NEGATIVE"


def label_for_score(score: float | None) -> str:
    if score is None:
        return "UNAVAILABLE"
    for lo, hi, label in SENTIMENT_LABELS:
        if lo <= score <= hi:
            return label
    return "NEUTRAL"


@dataclass
class IndexTrendInput:
    """Insumo de un índice para el componente de tendencia."""

    symbol: str
    name: str
    change_percent: float | None = None
    last_close: float | None = None
    short_avg: float | None = None  # promedio corto para "above average"


@dataclass
class SentimentInputs:
    """Insumos crudos para el proveedor (best-effort; cualquiera puede faltar)."""

    vix: float | None = None
    sp500: IndexTrendInput | None = None
    nasdaq: IndexTrendInput | None = None
    russell: IndexTrendInput | None = None
    gainers_count: int | None = None
    losers_count: int | None = None
    news_tone: float | None = None  # -1..1, o None si no hay


@dataclass
class SentimentComponent:
    name: str
    score: float
    status: str  # POSITIVE | NEUTRAL | NEGATIVE
    value: float | None
    source: str
    weight: float
    explanation: str

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "score": round(self.score),
            "status": self.status,
            "value": self.value,
            "source": self.source,
            "weight": self.weight,
            "explanation": self.explanation,
        }


@dataclass
class SentimentResult:
    score: int | None
    label: str
    confidence: str  # LOW | MEDIUM | HIGH
    source: str
    components: list[SentimentComponent] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "label": self.label,
            "confidence": self.confidence,
            "source": self.source,
            "components": [c.to_dict() for c in self.components],
            "warnings": self.warnings,
        }
