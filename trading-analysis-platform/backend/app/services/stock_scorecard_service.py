"""Executive Stock Scorecard.

Agrega datos YA disponibles (tecnico, fundamentales basicos de Yahoo, noticias
del simbolo, proxies de sentimiento) y los puntua 0-100 con una heuristica
simple y TRANSPARENTE: cada metrica reporta su valor, fuente, estado y cuanto
aporto al puntaje (`breakdown`). La puntuacion usa la configuracion del usuario
(dbo.C081): pesos y umbrales editables. NO es asesoria financiera.

Reglas: reutiliza los helpers de `ai_context_service`; cada bloque es
best-effort (si faltan datos baja la confianza y avisa); datos del usuario se
acotan por C005Id.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.repositories.acciones_repository import AccionesRepository
from app.repositories.catalogo_repository import CatalogoRepository
from app.repositories.scorecard_config_repository import ScorecardConfigRepository
from app.services import ai_context_service, news_service, yahoo_service
from app.services.scorecard_config import (
    SCORECARD_CONFIG_VERSION,
    merge_with_default,
)

logger = logging.getLogger("stock_scorecard")

# Fuentes de cada metrica (para transparencia en la UI).
SRC_TECH = "Internal technical calculation"
SRC_FUND = "Yahoo Finance"
SRC_NEWS = "News module"
SRC_MARKET = "Market data"
SRC_DRAWINGS = "User drawings"

# Estados de metrica.
POSITIVE, NEUTRAL, NEGATIVE, MISSING = "POSITIVE", "NEUTRAL", "NEGATIVE", "MISSING"


class ScorecardUnavailable(Exception):
    """No hay instrumento ni datos de mercado para construir el scorecard."""


_POSITIVE_NEWS = (
    "beats estimates", "beat estimates", "raises guidance", "raise guidance",
    "strong demand", "upgrade", "upgraded", "partnership", "record revenue",
    "margin expansion", "buyback", "share repurchase", "dividend increase",
    "contract win", "wins contract", "all-time high", "record profit",
    "outperform", "surge", "soars", "tops estimates",
)
_NEGATIVE_NEWS = (
    "misses estimates", "miss estimates", "cuts guidance", "cut guidance",
    "lowers guidance", "downgrade", "downgraded", "investigation", "lawsuit",
    "margin pressure", "weak demand", "layoffs", "job cuts", "debt concern",
    "regulatory risk", "recall", "probe", "fraud", "plunge", "slumps",
    "warning", "profit warning", "delist", "bankruptcy",
)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _metric(
    key: str,
    label: str,
    value,
    source: str,
    status: str,
    contribution: float,
    max_contribution: float,
    explanation: str,
    display: str | None = None,
) -> dict:
    return {
        "key": key,
        "label": label,
        "value": value,
        "displayValue": display if display is not None else _fmt(value),
        "source": source,
        "status": status,
        "scoreContribution": round(contribution, 1),
        "maxContribution": max_contribution,
        "explanation": explanation,
    }


def _fmt(value) -> str:
    if value is None:
        return "n/d"
    if isinstance(value, float):
        return f"{value:.2f}"
    return str(value)


def _pct(value) -> str:
    return "n/d" if value is None else f"{value * 100:.1f}%"


def _score_from_metrics(metrics: list[dict]) -> tuple[int | None, bool]:
    """Score 0-100 y disponibilidad a partir de las metricas no faltantes."""
    counted = [m for m in metrics if m["status"] != MISSING and m["maxContribution"] > 0]
    total_max = sum(m["maxContribution"] for m in counted)
    if total_max <= 0:
        return None, False
    total = sum(m["scoreContribution"] for m in counted)
    return round(total / total_max * 100), total_max >= 15


def _strengths_risks(metrics: list[dict], limit: int = 3) -> tuple[list[str], list[str]]:
    strengths = [m["explanation"] for m in metrics if m["status"] == POSITIVE][:limit]
    risks = [m["explanation"] for m in metrics if m["status"] == NEGATIVE][:limit]
    return strengths, risks


# --------------------------------------------------------------------------
# Tecnico
# --------------------------------------------------------------------------
def _score_technical(closes: list[float], daily: dict, ind: dict, config: dict) -> dict:
    out = {
        "score": None, "available": False, "extended": False, "below_sma200": False,
        "metrics": [], "strengths": [], "risks": [],
        "watch": ["SMA50 y SMA200", "RSI y MACD"],
    }
    if not closes or len(closes) < 20:
        return out

    metrics = out["metrics"]
    close = closes[-1]
    sma50, sma200, sma20 = ind.get("sma50"), ind.get("sma200"), ind.get("sma20")
    rsi = ind.get("rsi14")
    macd_line, macd_sig = ind.get("macd"), ind.get("macdSignal")
    bb_up = ind.get("bbUpper")
    vol_last, vol_avg = ind.get("volumeLast"), ind.get("volumeAvg20")
    high20, low20 = daily.get("high20d"), daily.get("low20d")

    ma = config.get("movingAverages", {}) if isinstance(config, dict) else {}
    p50 = float(ma.get("priceAboveSma50Points", 8))
    p200 = float(ma.get("priceAboveSma200Points", 10))
    pcross = float(ma.get("sma50AboveSma200Points", 12))

    metrics.append(_metric("price", "Precio", close, SRC_TECH, NEUTRAL, 0, 0,
                           "Precio actual (referencia)."))
    if sma50 is not None:
        ok = close > sma50
        metrics.append(_metric(
            "priceVsSma50", "Precio vs SMA50", sma50, SRC_TECH,
            POSITIVE if ok else NEGATIVE, p50 if ok else 0, p50,
            "Precio por encima de la SMA50." if ok else "Precio por debajo de la SMA50.",
            display=f"{close:.2f} vs {sma50:.2f}",
        ))
    if sma200 is not None:
        ok = close > sma200
        out["below_sma200"] = not ok
        metrics.append(_metric(
            "priceVsSma200", "Precio vs SMA200", sma200, SRC_TECH,
            POSITIVE if ok else NEGATIVE, p200 if ok else 0, p200,
            "Tendencia de fondo positiva (precio > SMA200)." if ok
            else "Tendencia de fondo débil (precio < SMA200).",
            display=f"{close:.2f} vs {sma200:.2f}",
        ))
    if sma50 is not None and sma200 is not None:
        ok = sma50 > sma200
        metrics.append(_metric(
            "smaCross", "SMA50 vs SMA200", None, SRC_TECH,
            POSITIVE if ok else NEGATIVE, pcross if ok else 0, pcross,
            "Estructura alcista (SMA50 > SMA200)." if ok
            else "Estructura bajista (SMA50 < SMA200).",
            display="alcista" if ok else "bajista",
        ))
    if sma20 is not None:
        ok = close > sma20
        metrics.append(_metric(
            "priceVsSma20", "Precio vs SMA20", sma20, SRC_TECH,
            POSITIVE if ok else NEUTRAL, 6 if ok else 0, 6,
            "Por encima de la SMA20 (corto plazo positivo)." if ok
            else "Por debajo de la SMA20.",
            display=f"{close:.2f} vs {sma20:.2f}",
        ))

    rsi_cfg = config.get("rsi", {}) if isinstance(config, dict) else {}
    imin, imax = float(rsi_cfg.get("idealMin", 45)), float(rsi_cfg.get("idealMax", 65))
    over = float(rsi_cfg.get("overbought", 75))
    under = float(rsi_cfg.get("oversold", 30))
    if rsi is not None:
        if imin <= rsi <= imax:
            st, c, exp = POSITIVE, 15, f"RSI en zona constructiva ({rsi:.0f})."
        elif rsi > over:
            st, c, exp = NEGATIVE, 3, f"RSI sobreextendido ({rsi:.0f})."
            out["extended"] = True
        elif rsi < under:
            st, c, exp = NEUTRAL, 5, f"RSI en sobreventa ({rsi:.0f})."
        else:
            st, c, exp = NEUTRAL, 9, f"RSI neutral ({rsi:.0f})."
        metrics.append(_metric("rsi14", "RSI 14", rsi, SRC_TECH, st, c, 15, exp,
                               display=f"{rsi:.1f}"))
    if macd_line is not None and macd_sig is not None:
        ok = macd_line > macd_sig
        metrics.append(_metric(
            "macd", "MACD", "alcista" if ok else "bajista", SRC_TECH,
            POSITIVE if ok else NEGATIVE, 10 if ok else 0, 10,
            "MACD por encima de su señal (momentum positivo)." if ok
            else "MACD por debajo de su señal (momentum débil).",
            display="alcista" if ok else "bajista",
        ))
    if bb_up is not None:
        near = close >= bb_up
        if near:
            out["extended"] = True
        metrics.append(_metric(
            "bollinger", "Posición Bollinger", close, SRC_TECH,
            NEGATIVE if near else NEUTRAL, 0 if near else 5, 5,
            "En/por encima de la banda superior (extendido)." if near
            else "Dentro de las bandas de Bollinger.",
            display="banda superior" if near else "intermedio",
        ))
    if vol_last is not None and vol_avg:
        ok = vol_last >= vol_avg
        metrics.append(_metric(
            "volume", "Volumen vs promedio 20d", vol_last, SRC_TECH,
            POSITIVE if ok else NEUTRAL, 10 if ok else 4, 10,
            "Volumen por encima de su promedio de 20 sesiones." if ok
            else "Volumen por debajo de su promedio.",
            display=f"{vol_last:.0f}",
        ))
    if high20 is not None and low20 is not None and high20 > low20:
        pos = (close - low20) / (high20 - low20)
        if pos <= 0.35:
            st, c, exp = POSITIVE, 16, "Cerca del soporte de 20 sesiones (mejor relación R/B)."
        elif pos <= 0.70:
            st, c, exp = NEUTRAL, 12, "En la mitad del rango de 20 sesiones."
        elif pos <= 0.85:
            st, c, exp = NEUTRAL, 7, "Acercándose a la resistencia de 20 sesiones."
        else:
            st, c, exp = NEGATIVE, 4, "Cerca de la resistencia de 20 sesiones (entrada tardía)."
            out["extended"] = True
        metrics.append(_metric(
            "rangePosition", "Posición en rango 20d", round(pos * 100, 1), SRC_TECH,
            st, c, 16, exp, display=f"{pos * 100:.0f}%",
        ))
    # Channel R/R: lo calcula el frontend con tus dibujos; aqui solo se reporta.
    metrics.append(_metric(
        "channelRiskReward", "Canal R/R", None, SRC_DRAWINGS, MISSING, 0, 0,
        "Disponible en el panel de Channel R/R con tus dibujos.",
        display="ver panel",
    ))

    out["score"], out["available"] = _score_from_metrics(metrics)
    out["strengths"], out["risks"] = _strengths_risks(metrics)
    return out


# --------------------------------------------------------------------------
# Fundamentales
# --------------------------------------------------------------------------
def _band_metric(key, label, value, max_c, tiers, source=SRC_FUND, display=None,
                 missing_exp="Dato no disponible."):
    """tiers: lista [(umbral, contribucion, status, explicacion)] en orden; el
    primero cuyo predicado se cumple gana. Cada tier: (pred(value)->bool, c, st, exp).
    """
    if value is None:
        return _metric(key, label, None, source, MISSING, 0, max_c, missing_exp,
                       display="n/d")
    for pred, c, st, exp in tiers:
        if pred(value):
            return _metric(key, label, value, source, st, c, max_c, exp, display=display)
    return _metric(key, label, value, source, NEUTRAL, 0, max_c,
                   "Sin clasificación.", display=display)


def _score_fundamentals(f: dict, config: dict) -> dict:
    out = {"score": None, "available": False, "metrics": [], "strengths": [],
           "risks": [], "watch": ["Noticias de earnings o guidance"]}
    metrics = out["metrics"]

    pe_c = config.get("peRatio", {}) if isinstance(config, dict) else {}
    roe_c = config.get("roe", {})
    roa_c = config.get("roa", {})
    pm_c = config.get("profitMargin", {})
    rg_c = config.get("revenueGrowth", {})
    de_c = config.get("debtToEquity", {})
    cr_c = config.get("currentRatio", {})

    pe = (f.get("trailingPE") or f.get("forwardPE")) if f else None
    metrics.append(_band_metric(
        "peRatio", "P/E", pe, 13, [
            (lambda v: v <= pe_c.get("excellentMax", 10), 13, POSITIVE, "P/E muy atractivo."),
            (lambda v: v <= pe_c.get("goodMax", 20), 9, POSITIVE, "P/E razonable."),
            (lambda v: v < pe_c.get("expensiveAbove", 35), 5, NEUTRAL, "P/E algo elevado."),
            (lambda v: True, 2, NEGATIVE, "Valuación exigente (P/E alto)."),
        ], display=None if pe is None else f"{pe:.1f}",
        missing_exp="P/E no disponible.",
    ))
    pe = pe if pe is not None and pe > 0 else None  # noqa: F841 (claridad)

    roe = f.get("returnOnEquity") if f else None
    metrics.append(_band_metric(
        "roe", "ROE", roe, 10, [
            (lambda v: v * 100 >= roe_c.get("excellentMin", 20), 10, POSITIVE, "ROE excelente."),
            (lambda v: v * 100 >= roe_c.get("goodMin", 12), 6, POSITIVE, "ROE sólido."),
            (lambda v: v * 100 > roe_c.get("weakBelow", 5), 3, NEUTRAL, "ROE moderado."),
            (lambda v: True, 0, NEGATIVE, "ROE débil."),
        ], display=_pct(roe), missing_exp="ROE no disponible."))

    roa = f.get("returnOnAssets") if f else None
    metrics.append(_band_metric(
        "roa", "ROA", roa, 5, [
            (lambda v: v * 100 >= roa_c.get("excellentMin", 10), 5, POSITIVE, "ROA excelente."),
            (lambda v: v * 100 >= roa_c.get("goodMin", 5), 3, NEUTRAL, "ROA bueno."),
            (lambda v: v * 100 > roa_c.get("weakBelow", 2), 1, NEUTRAL, "ROA moderado."),
            (lambda v: True, 0, NEGATIVE, "ROA débil."),
        ], display=_pct(roa), missing_exp="ROA no disponible."))

    pm = f.get("profitMargins") if f else None
    metrics.append(_band_metric(
        "profitMargin", "Margen de utilidad", pm, 10, [
            (lambda v: v * 100 >= pm_c.get("excellentMin", 20), 10, POSITIVE, "Márgenes sólidos."),
            (lambda v: v * 100 >= pm_c.get("goodMin", 10), 6, POSITIVE, "Márgenes saludables."),
            (lambda v: v * 100 > pm_c.get("weakBelow", 3), 3, NEUTRAL, "Márgenes ajustados."),
            (lambda v: True, 0, NEGATIVE, "Márgenes muy bajos o negativos."),
        ], display=_pct(pm), missing_exp="Margen no disponible."))

    rg = f.get("revenueGrowth") if f else None
    metrics.append(_band_metric(
        "revenueGrowth", "Crecimiento de ingresos", rg, 10, [
            (lambda v: v * 100 >= rg_c.get("excellentMin", 15), 10, POSITIVE, "Crecimiento de ingresos fuerte."),
            (lambda v: v * 100 >= rg_c.get("goodMin", 5), 6, POSITIVE, "Crecimiento de ingresos saludable."),
            (lambda v: v * 100 >= rg_c.get("negativeBelow", 0), 3, NEUTRAL, "Crecimiento de ingresos bajo."),
            (lambda v: True, 0, NEGATIVE, "Ingresos en contracción."),
        ], display=_pct(rg), missing_exp="Crecimiento no disponible."))

    de = f.get("debtToEquity") if f else None
    metrics.append(_band_metric(
        "debtToEquity", "Deuda / Capital", de, 12, [
            (lambda v: v <= de_c.get("excellentMax", 30), 12, POSITIVE, "Bajo apalancamiento."),
            (lambda v: v <= de_c.get("goodMax", 80), 9, NEUTRAL, "Apalancamiento moderado."),
            (lambda v: v < de_c.get("riskyAbove", 150), 5, NEUTRAL, "Apalancamiento elevado."),
            (lambda v: True, 2, NEGATIVE, "Apalancamiento alto (deuda/capital alta)."),
        ], display=None if de is None else f"{de:.0f}", missing_exp="Deuda/capital no disponible."))

    cr = f.get("currentRatio") if f else None
    metrics.append(_band_metric(
        "currentRatio", "Current ratio", cr, 8, [
            (lambda v: v >= cr_c.get("goodMin", 1.5), 8, POSITIVE, "Buena liquidez."),
            (lambda v: v >= cr_c.get("weakBelow", 1.0), 5, NEUTRAL, "Liquidez aceptable."),
            (lambda v: True, 2, NEGATIVE, "Liquidez ajustada (current ratio < 1)."),
        ], display=None if cr is None else f"{cr:.2f}", missing_exp="Current ratio no disponible."))

    ps = f.get("priceToSalesTrailing12Months") if f else None
    metrics.append(_band_metric(
        "priceToSales", "Price / Sales", ps, 6, [
            (lambda v: v < 2, 6, POSITIVE, "P/S bajo."),
            (lambda v: v < 5, 4, NEUTRAL, "P/S moderado."),
            (lambda v: v < 10, 2, NEUTRAL, "P/S elevado."),
            (lambda v: True, 1, NEGATIVE, "P/S muy elevado."),
        ], display=None if ps is None else f"{ps:.2f}", missing_exp="P/S no disponible."))

    pb = f.get("priceToBook") if f else None
    metrics.append(_band_metric(
        "priceToBook", "Price / Book", pb, 6, [
            (lambda v: v < 2, 6, POSITIVE, "P/B bajo."),
            (lambda v: v < 4, 4, NEUTRAL, "P/B moderado."),
            (lambda v: v < 8, 2, NEUTRAL, "P/B elevado."),
            (lambda v: True, 1, NEGATIVE, "P/B muy elevado."),
        ], display=None if pb is None else f"{pb:.2f}", missing_exp="P/B no disponible."))

    dy = f.get("dividendYield") if f else None
    if dy is not None and dy > 0:
        dy_n = dy / 100 if dy > 1 else dy
        good = 0.01 <= dy_n <= 0.06
        metrics.append(_metric(
            "dividendYield", "Dividend yield", dy_n, SRC_FUND,
            POSITIVE, 6 if good else 3, 6,
            "Paga dividendo razonable." if good else "Paga dividendo.",
            display=_pct(dy_n)))

    out["score"], out["available"] = _score_from_metrics(metrics)
    out["strengths"], out["risks"] = _strengths_risks(metrics)
    return out


# --------------------------------------------------------------------------
# Noticias
# --------------------------------------------------------------------------
def _score_news(items: list[dict], config: dict) -> dict:
    out = {"score": None, "available": False, "metrics": [], "strengths": [],
           "risks": [], "top": []}
    if not items:
        return out
    out["available"] = True
    boost = config.get("positiveHeadlineBoost", 10) if isinstance(config, dict) else 10
    penalty = config.get("negativeHeadlinePenalty", 15) if isinstance(config, dict) else 15
    metrics = out["metrics"]
    net = 0.0
    for item in items[:8]:
        title = item.get("title") or ""
        text = f"{title} {item.get('summary') or ''}".lower()
        pos = sum(1 for kw in _POSITIVE_NEWS if kw in text)
        neg = sum(1 for kw in _NEGATIVE_NEWS if kw in text)
        if pos and not neg:
            net += boost / 10
            status, exp = POSITIVE, "Titular positivo."
        elif neg and not pos:
            net -= penalty / 10
            status, exp = NEGATIVE, "Titular negativo."
        else:
            status, exp = NEUTRAL, "Titular neutral."
        if len(metrics) < 5 and title:
            metrics.append(_metric(
                f"news_{len(metrics)}", title[:80],
                item.get("publisher"), SRC_NEWS, status, 0, 0, exp,
                display=item.get("publisher") or "—",
            ))
    out["top"] = [m["label"] for m in metrics[:3]]
    out["score"] = round(_clamp(50 + net * 8, 0, 100))
    out["strengths"] = [m["label"] for m in metrics if m["status"] == POSITIVE][:2]
    out["risks"] = [m["label"] for m in metrics if m["status"] == NEGATIVE][:2]
    return out


# --------------------------------------------------------------------------
# Sentimiento
# --------------------------------------------------------------------------
def _score_sentiment(config: dict | None = None) -> dict:
    config = config if isinstance(config, dict) else {}
    low = float(config.get("vixLowRiskMax", 16))
    med = float(config.get("vixMediumRiskMax", 24))
    high = float(config.get("vixHighRiskAbove", 30))
    # Misma lógica/umbrales que el proveedor interno de sentimiento (Fase 2).
    out = {"score": None, "metrics": [], "strengths": [], "risks": [],
           "source": "unavailable"}
    vix = sp = None
    try:
        vix = yahoo_service.get_quote("^VIX")
    except Exception:  # noqa: BLE001
        vix = None
    try:
        sp = yahoo_service.get_quote("^GSPC")
    except Exception:  # noqa: BLE001
        sp = None
    metrics = out["metrics"]
    if vix is None and sp is None:
        return out
    score = 50.0
    if sp is not None and sp.changePercent is not None:
        score += _clamp(sp.changePercent * 5, -20, 20)
        up = sp.changePercent > 0
        metrics.append(_metric(
            "sp500", "S&P 500 (hoy)", sp.changePercent, SRC_MARKET,
            POSITIVE if up else NEGATIVE, 0, 0,
            "Mercado general al alza hoy." if up else "Mercado general a la baja hoy.",
            display=f"{sp.changePercent:+.2f}%"))
    if vix is not None and vix.price is not None:
        v = vix.price
        if v <= low:
            score += 12; st, exp = POSITIVE, "Volatilidad baja (apetito de riesgo)."
        elif v <= med:
            score += 4; st, exp = NEUTRAL, "Volatilidad normal."
        elif v <= high:
            score -= 6; st, exp = NEUTRAL, "Volatilidad elevada."
        else:
            score -= 16; st, exp = NEGATIVE, "Alta aversión al riesgo (VIX elevado)."
        metrics.append(_metric("vix", "VIX", v, SRC_MARKET, st, 0, 0, exp,
                               display=f"{v:.1f}"))
    out["score"] = round(_clamp(score, 0, 100))
    out["source"] = "internal_market_sentiment_provider"
    out["strengths"] = [m["explanation"] for m in metrics if m["status"] == POSITIVE]
    out["risks"] = [m["explanation"] for m in metrics if m["status"] == NEGATIVE]
    return out


# --------------------------------------------------------------------------
# Agregacion
# --------------------------------------------------------------------------
def _overall_score(tech, fund, news, sent, weights: dict | None = None) -> int | None:
    weights = weights or {"technical": 40, "fundamentals": 30, "news": 20, "sentiment": 10}
    parts = {
        "technical": tech["score"], "fundamentals": fund["score"],
        "news": news["score"], "sentiment": sent["score"],
    }
    available = {k: v for k, v in parts.items() if v is not None}
    if not available:
        return None
    total_weight = sum(float(weights.get(k, 0)) for k in available)
    if total_weight <= 0:
        return None
    weighted = sum(float(weights.get(k, 0)) * v for k, v in available.items())
    return round(weighted / total_weight)


def _risk_level(overall, tech, fund, news, sent) -> str:
    available = sum(
        1 for s in (tech["score"], fund["score"], news["score"]) if s is not None
    )
    if available == 0:
        return "UNKNOWN"
    rf = 0
    if tech.get("extended"):
        rf += 1
    if tech.get("below_sma200"):
        rf += 1
    if news["score"] is not None and news["score"] < 40:
        rf += 1
    if any("Apalancamiento alto" in r or "Liquidez ajustada" in r for r in fund["risks"]):
        rf += 1
    if sent["score"] is not None and sent["score"] < 40:
        rf += 1
    if overall is not None and overall < 45:
        rf += 1
    if rf <= 0:
        return "LOW"
    if rf == 1:
        return "MEDIUM"
    if rf == 2:
        return "HIGH"
    return "VERY_HIGH"


def _confidence_level(tech, fund, news) -> str:
    t, f, n = tech["available"], fund["available"], news["available"]
    if t and f and n:
        return "HIGH"
    if t and (f or n):
        return "MEDIUM"
    return "LOW"


def _map_view(overall, tech, fund, news, risk) -> str:
    available = sum(
        1 for s in (tech["score"], fund["score"], news["score"]) if s is not None
    )
    if overall is None or available < 2:
        return "INSUFFICIENT_DATA"
    extended = bool(tech.get("extended"))
    tech_s, fund_s, news_s = tech["score"], fund["score"], news["score"]
    major_neg_news = news_s is not None and news_s < 35
    if overall < 50:
        return "RISKY_AVOID_FOR_NOW"
    if fund_s is not None and fund_s >= 70 and extended:
        return "FUNDAMENTALLY_GOOD_BUT_TECHNICALLY_EXTENDED"
    if overall >= 75 and risk not in ("HIGH", "VERY_HIGH") and not extended and not major_neg_news:
        return "ATTRACTIVE_NOW"
    if overall >= 65 and extended:
        return "INTERESTING_BUT_WAIT_FOR_PULLBACK"
    if tech_s is not None and tech_s >= 70 and (fund_s is None or fund_s < 60):
        return "TECHNICALLY_STRONG_BUT_FUNDAMENTALS_MIXED"
    if overall >= 65:
        return "INTERESTING_BUT_WAIT_FOR_PULLBACK"
    return "MIXED_REQUIRES_CONFIRMATION"


_VIEW_PHRASE = {
    "ATTRACTIVE_NOW": "luce atractiva en este momento",
    "INTERESTING_BUT_WAIT_FOR_PULLBACK": "es interesante, pero conviene esperar un retroceso o confirmación",
    "FUNDAMENTALLY_GOOD_BUT_TECHNICALLY_EXTENDED": "tiene buenos fundamentales pero el precio luce técnicamente extendido",
    "TECHNICALLY_STRONG_BUT_FUNDAMENTALS_MIXED": "es técnicamente fuerte, aunque sus fundamentales lucen mixtos",
    "MIXED_REQUIRES_CONFIRMATION": "muestra señales mixtas y requiere confirmación",
    "RISKY_AVOID_FOR_NOW": "luce riesgosa por ahora",
    "INSUFFICIENT_DATA": "no tiene datos suficientes para una lectura confiable",
}


def _spanish_summary(symbol, view, tech, fund, news, sent, risk) -> str:
    phrase = _VIEW_PHRASE.get(view, "muestra señales mixtas")
    sentences = [f"{symbol} {phrase}."]
    if tech["score"] is not None:
        sentences.append(
            "La estructura técnica general es constructiva." if tech["score"] >= 65
            else "La estructura técnica es neutral." if tech["score"] >= 45
            else "La estructura técnica luce débil."
        )
    if fund["score"] is not None:
        sentences.append(
            "Los fundamentales disponibles son sólidos." if fund["score"] >= 65
            else "Los fundamentales disponibles son razonables." if fund["score"] >= 45
            else "Los fundamentales disponibles lucen flojos."
        )
    elif view != "INSUFFICIENT_DATA":
        sentences.append("Los fundamentales disponibles son limitados.")
    main_risk = (tech["risks"] + fund["risks"] + news["risks"])[:1]
    if main_risk:
        sentences.append(f"Principal riesgo: {main_risk[0].lower()}")
    sentences.append(
        "Conviene gestionar el riesgo y vigilar soportes clave."
        if risk in ("HIGH", "VERY_HIGH")
        else "Vale la pena vigilar SMA50/SMA200, RSI/MACD y noticias de earnings."
    )
    sentences.append("Esto es análisis informativo, no asesoría financiera.")
    return " ".join(sentences[:6])


def _dedupe(items: list[str], limit: int) -> list[str]:
    seen, out = set(), []
    for it in items:
        if it and it not in seen:
            seen.add(it)
            out.append(it)
        if len(out) >= limit:
            break
    return out


def _breakdown_section(section: dict) -> dict:
    return {"score": section.get("score"), "metrics": section.get("metrics", [])}


# --------------------------------------------------------------------------
# Entrada principal
# --------------------------------------------------------------------------
def build_stock_scorecard(
    db: Session,
    user_id: int,
    symbol: str,
    workspace_id: int | None = None,
    focused_chart_slot_id: str | None = None,
    force_refresh: bool = False,
) -> dict:
    symbol_up = symbol.strip().upper()
    if not symbol_up:
        raise ScorecardUnavailable("symbol vacío")

    # Config de puntuacion del usuario (se crea el default si no existe).
    cfg_repo = ScorecardConfigRepository(db)
    cfg_row = cfg_repo.get_or_create_default(user_id)
    db.commit()
    config = merge_with_default(_safe_config(cfg_row.ConfiguracionJSON))
    weights = config.get("weights", {})

    accion = AccionesRepository(db).get_by_yahoo_symbol(symbol_up)
    c010_id = accion.C010Id if accion is not None else None
    company_name = accion.NombreInstrumento if accion is not None else None
    warnings: list[str] = []

    try:
        market = ai_context_service._market_summary(symbol_up)
    except Exception:  # noqa: BLE001
        market = {"market_data_available": False}
    closes = market.pop("_closes_1d", []) if isinstance(market, dict) else []
    volumes = market.pop("_volumes_1d", []) if isinstance(market, dict) else []
    quote = (market.get("quote") or {}) if isinstance(market, dict) else {}
    daily = (market.get("daily_1y") or {}) if isinstance(market, dict) else {}
    ind = ai_context_service._indicator_values(closes, volumes) if closes else {}
    tech = _score_technical(closes, daily, ind, config.get("technical", {}))

    try:
        fundamentals = yahoo_service.get_fundamentals(symbol_up, force_refresh=force_refresh)
    except Exception:  # noqa: BLE001
        fundamentals = {}
    fund = _score_fundamentals(fundamentals or {}, config.get("fundamentals", {}))
    if not company_name:
        company_name = (fundamentals or {}).get("longName") or (
            fundamentals or {}
        ).get("shortName")

    try:
        news_items = news_service.get_symbol_news(symbol_up, limit=8)
    except Exception:  # noqa: BLE001
        news_items = []
    news = _score_news(news_items or [], config.get("news", {}))

    sent = _score_sentiment(config.get("sentiment", {}))
    if sent["score"] is None:
        warnings.append("Market sentiment data is limited.")

    if accion is None and not closes and not fundamentals:
        raise ScorecardUnavailable(f"Sin datos para {symbol_up}")

    overall = _overall_score(tech, fund, news, sent, weights)
    risk = _risk_level(overall, tech, fund, news, sent)
    confidence = _confidence_level(tech, fund, news)
    view = _map_view(overall, tech, fund, news, risk)
    summary = _spanish_summary(symbol_up, view, tech, fund, news, sent, risk)

    if not fund["available"]:
        warnings.append("Fundamental data is limited.")
    if not news["available"]:
        warnings.append("News data is limited.")
    if confidence == "LOW":
        warnings.append("Confianza baja: datos parciales.")

    user_watch: list[str] = []
    current_price = quote.get("price") if isinstance(quote, dict) else None
    if c010_id is not None:
        try:
            entry = CatalogoRepository(db).get_entry(user_id, c010_id)
            if entry is not None and entry.Notas and entry.Notas.strip():
                user_watch.append(f"Tu nota: {entry.Notas.strip()[:80]}")
        except Exception:  # noqa: BLE001
            pass
        try:
            sims = ai_context_service._simulated_entries(
                db, user_id, c010_id, current_price
            )
            if any(s.get("status") == "ABIERTA" for s in sims):
                user_watch.append("Tienes entradas simuladas abiertas en este símbolo")
        except Exception:  # noqa: BLE001
            pass

    # Contexto macro (Fase 3): SOLO lee el cache C080 (sin red); None si la
    # página macro no se ha cargado. Nunca rompe el scorecard.
    macro_context = None
    try:
        from app.services import macro as macro_service
        macro_context = macro_service.get_macro_context(db)
    except Exception:  # noqa: BLE001
        macro_context = None
    macro_watch: list[str] = []
    if macro_context and macro_context.get("riskLevel") in ("YELLOW", "RED"):
        macro_watch.append(
            "Vigila los próximos datos de inflación/Fed: las acciones de valuación "
            "alta pueden reaccionar con fuerza"
        )

    watch = _dedupe(
        user_watch + tech["watch"] + fund["watch"] + macro_watch
        + ["Canal R/R si está disponible"],
        limit=6,
    )
    strengths = _dedupe(
        tech["strengths"] + fund["strengths"] + news["strengths"] + sent["strengths"], 5
    )
    risks = _dedupe(
        tech["risks"] + fund["risks"] + news["risks"] + sent["risks"], 5
    )

    return {
        "symbol": symbol_up,
        "companyName": company_name,
        "technicalScore": tech["score"],
        "fundamentalScore": fund["score"],
        "newsScore": news["score"],
        "sentimentScore": sent["score"],
        "sentimentSource": sent.get("source", "unavailable"),
        "overallScore": overall,
        "riskLevel": risk,
        "confidenceLevel": confidence,
        "overallView": view,
        "summary": summary,
        "strengths": strengths,
        "risks": risks,
        "watchItems": watch,
        "macroContext": macro_context,
        "dataAvailability": {
            "technical": tech["available"],
            "fundamentals": fund["available"],
            "news": news["available"],
            "sentiment": sent["score"] is not None,
        },
        "breakdown": {
            "technical": _breakdown_section(tech),
            "fundamentals": _breakdown_section(fund),
            "news": _breakdown_section(news),
            "sentiment": _breakdown_section(sent),
        },
        "scoringConfig": {
            "c081Id": cfg_row.C081Id,
            "name": cfg_row.NombreConfiguracion,
            "version": config.get("version", SCORECARD_CONFIG_VERSION),
        },
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "warnings": warnings,
    }


def _safe_config(raw: str | None) -> dict:
    try:
        value = json.loads(raw) if raw else {}
        return value if isinstance(value, dict) else {}
    except (TypeError, ValueError):
        return {}
