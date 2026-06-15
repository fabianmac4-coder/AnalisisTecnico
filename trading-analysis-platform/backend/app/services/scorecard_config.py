"""Configuracion de puntuacion del Stock Scorecard (pesos + umbrales).

`DEFAULT_SCORECARD_CONFIG` es la config base; el usuario la edita y se guarda en
dbo.C081. El servicio de scorecard lee de aqui (con fallback al default si falta
una clave), de modo que una config parcial o corrupta nunca rompe el calculo.
"""
from __future__ import annotations

from typing import Any

SCORECARD_CONFIG_VERSION = 1

DEFAULT_SCORECARD_CONFIG: dict[str, Any] = {
    "version": SCORECARD_CONFIG_VERSION,
    "weights": {
        "technical": 40,
        "fundamentals": 30,
        "news": 20,
        "sentiment": 10,
    },
    "technical": {
        "rsi": {"idealMin": 45, "idealMax": 65, "overbought": 75, "oversold": 30},
        "movingAverages": {
            "priceAboveSma50Points": 8,
            "priceAboveSma200Points": 10,
            "sma50AboveSma200Points": 12,
        },
        "channelRiskReward": {
            "excellentRatio": 3.0,
            "goodRatio": 2.0,
            "minimumAcceptableRatio": 1.5,
        },
    },
    "fundamentals": {
        "peRatio": {
            "excellentMax": 10,
            "goodMax": 20,
            "expensiveAbove": 35,
            "veryExpensiveAbove": 50,
        },
        "roe": {"excellentMin": 20, "goodMin": 12, "weakBelow": 5},
        "roa": {"excellentMin": 10, "goodMin": 5, "weakBelow": 2},
        "profitMargin": {"excellentMin": 20, "goodMin": 10, "weakBelow": 3},
        "revenueGrowth": {"excellentMin": 15, "goodMin": 5, "negativeBelow": 0},
        "debtToEquity": {"excellentMax": 30, "goodMax": 80, "riskyAbove": 150},
        "currentRatio": {"goodMin": 1.5, "weakBelow": 1.0},
    },
    "news": {
        "positiveHeadlineBoost": 10,
        "negativeHeadlinePenalty": 15,
        "maxNewsAgeDays": 14,
    },
    "sentiment": {
        "vixLowRiskMax": 16,
        "vixMediumRiskMax": 24,
        "vixHighRiskAbove": 30,
    },
}


class InvalidScorecardConfig(ValueError):
    """La config de scorecard no es valida (pesos/umbrales)."""


def validate_config(config: dict) -> None:
    """Valida pesos/umbrales. Lanza InvalidScorecardConfig si no aplica.

    - weights numericos y >= 0; el total DEBE ser 100.
    - los umbrales presentes deben ser numericos.
    """
    if not isinstance(config, dict):
        raise InvalidScorecardConfig("La configuración debe ser un objeto.")
    weights = config.get("weights")
    if not isinstance(weights, dict):
        raise InvalidScorecardConfig("Faltan los pesos (weights).")
    total = 0.0
    for key in ("technical", "fundamentals", "news", "sentiment"):
        value = weights.get(key)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise InvalidScorecardConfig(f"El peso '{key}' debe ser numérico.")
        if value < 0:
            raise InvalidScorecardConfig(f"El peso '{key}' no puede ser negativo.")
        total += float(value)
    if round(total) != 100:
        raise InvalidScorecardConfig("Score weights must total 100.")
    # Umbrales: cualquier valor de hoja en estas secciones debe ser numerico.
    for section in ("technical", "fundamentals", "news", "sentiment"):
        node = config.get(section)
        if node is not None and not _all_leaves_numeric(node):
            raise InvalidScorecardConfig(
                f"Los umbrales de '{section}' deben ser numéricos."
            )


def _all_leaves_numeric(node) -> bool:
    if isinstance(node, dict):
        return all(_all_leaves_numeric(v) for v in node.values())
    return isinstance(node, (int, float)) and not isinstance(node, bool)


def merge_with_default(config: dict | None) -> dict:
    """Funde una config (posiblemente parcial) con el default (recursivo)."""
    if not isinstance(config, dict):
        return _deepcopy(DEFAULT_SCORECARD_CONFIG)
    return _deep_merge(_deepcopy(DEFAULT_SCORECARD_CONFIG), config)


def cfg(config: dict, *path: str, default: Any = None) -> Any:
    """Lee `config[path...]` con fallback seguro (nunca lanza)."""
    node: Any = config
    for key in path:
        if not isinstance(node, dict) or key not in node:
            return default
        node = node[key]
    return node


def _deep_merge(base: dict, override: dict) -> dict:
    for key, value in override.items():
        if (
            key in base
            and isinstance(base[key], dict)
            and isinstance(value, dict)
        ):
            _deep_merge(base[key], value)
        else:
            base[key] = value
    return base


def _deepcopy(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _deepcopy(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_deepcopy(v) for v in value]
    return value
