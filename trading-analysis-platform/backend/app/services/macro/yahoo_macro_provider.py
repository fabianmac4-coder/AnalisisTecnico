"""Proxies macro basados en mercado vía Yahoo (best-effort).

Rendimientos del Tesoro (^FVX/^TNX/^TYX), FX, materias primas y cripto. Cada
quote se intenta por separado: un fallo NO tumba el resto. El frontend nunca
llama a Yahoo directo.
"""
from __future__ import annotations

from app.services import yahoo_service
from app.services.macro import macro_types as t

# Rendimientos del Tesoro en Yahoo (índices de yield). 2Y no tiene índice Yahoo
# estable -> sólo disponible vía FRED (DGS2).
TREASURY = {
    "treasury5Y": ("^FVX", "Tesoro 5 años"),
    "treasury10Y": ("^TNX", "Tesoro 10 años"),
    "treasury30Y": ("^TYX", "Tesoro 30 años"),
}

FX = [
    ("EURUSD=X", "EUR/USD"),
    ("GBPUSD=X", "GBP/USD"),
    ("JPY=X", "USD/JPY"),
    ("CHF=X", "USD/CHF"),
    ("MXN=X", "USD/MXN"),
]
COMMODITIES = [
    ("GC=F", "Oro"),
    ("SI=F", "Plata"),
    ("CL=F", "Petróleo WTI"),
    ("BZ=F", "Petróleo Brent"),
    ("NG=F", "Gas natural"),
]
CRYPTO = [
    ("BTC-USD", "Bitcoin"),
    ("ETH-USD", "Ethereum"),
    ("BNB-USD", "BNB"),
    ("SOL-USD", "Solana"),
    ("XRP-USD", "XRP"),
]


def _safe_quote(symbol: str):
    try:
        return yahoo_service.get_quote(symbol)
    except Exception:  # noqa: BLE001
        return None


def _market_item(symbol: str, name: str) -> dict | None:
    q = _safe_quote(symbol)
    if q is None or q.price is None:
        return None
    cp = q.changePercent
    if cp is not None and cp > 0.05:
        trend, status = t.IMPROVING, t.POSITIVE
    elif cp is not None and cp < -0.05:
        trend, status = t.WORSENING, t.NEGATIVE
    else:
        trend, status = t.STABLE, t.NEUTRAL
    return t.indicator(
        symbol, name, round(q.price, 4),
        display_value=f"{q.price:,.4f}" if q.price < 10 else f"{q.price:,.2f}",
        change=q.change, trend=trend, status=status, source="Yahoo Finance",
        extra={"symbol": symbol, "changePercent": cp},
    )


def fetch_treasuries() -> tuple[dict, list[str]]:
    """{key -> indicador} de rendimientos del Tesoro (5/10/30Y). 2Y queda fuera."""
    out: dict = {}
    warnings: list[str] = []
    for key, (symbol, label) in TREASURY.items():
        q = _safe_quote(symbol)
        if q is None or q.price is None:
            out[key] = t.missing_indicator(key, label, source="Yahoo Finance")
            continue
        out[key] = t.indicator(
            key, label, round(q.price, 3),
            display_value=f"{q.price:.2f}%",
            change=q.change, trend=t.UNKNOWN, status=t.NEUTRAL,
            source="Yahoo Finance",
        )
    return out, warnings


def fetch_global_markets() -> tuple[dict, list[str]]:
    """{fx, commodities, crypto} como listas de indicadores de mercado."""
    warnings: list[str] = []

    def collect(pairs: list[tuple[str, str]]) -> list[dict]:
        items = []
        for symbol, name in pairs:
            item = _market_item(symbol, name)
            if item is not None:
                items.append(item)
        return items

    fx = collect(FX)
    commodities = collect(COMMODITIES)
    crypto = collect(CRYPTO)
    if not fx and not commodities and not crypto:
        warnings.append("Global market data unavailable.")
    return {"fx": fx, "commodities": commodities, "crypto": crypto}, warnings
