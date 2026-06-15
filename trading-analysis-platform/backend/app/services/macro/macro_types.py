"""Tipos y helpers del Macro Dashboard."""
from __future__ import annotations

# Trend
IMPROVING = "IMPROVING"
WORSENING = "WORSENING"
STABLE = "STABLE"
UNKNOWN = "UNKNOWN"

# Status
POSITIVE = "POSITIVE"
NEUTRAL = "NEUTRAL"
NEGATIVE = "NEGATIVE"
MISSING = "MISSING"

# Risk
GREEN = "GREEN"
YELLOW = "YELLOW"
RED = "RED"
RISK_UNKNOWN = "UNKNOWN"

# Yield curve
CURVE_NORMAL = "NORMAL"
CURVE_FLAT = "FLAT"
CURVE_INVERTED = "INVERTED"
CURVE_UNKNOWN = "UNKNOWN"


def indicator(
    key: str,
    label: str,
    value: float | None,
    *,
    display_value: str | None = None,
    previous_value: float | None = None,
    change: float | None = None,
    trend: str = UNKNOWN,
    status: str = NEUTRAL,
    source: str = "FRED",
    last_updated: str | None = None,
    explanation: str | None = None,
    extra: dict | None = None,
) -> dict:
    out = {
        "key": key,
        "label": label,
        "value": value,
        "displayValue": display_value if display_value is not None else (
            "Unavailable" if value is None else str(value)
        ),
        "previousValue": previous_value,
        "change": change,
        "trend": trend,
        "status": status,
        "source": source,
        "lastUpdated": last_updated,
        "explanation": explanation,
    }
    if extra:
        out.update(extra)
    return out


def missing_indicator(key: str, label: str, source: str = "FRED") -> dict:
    return indicator(
        key, label, None,
        display_value="Unavailable", trend=UNKNOWN, status=MISSING, source=source,
        explanation="Provider not configured or data unavailable.",
    )
