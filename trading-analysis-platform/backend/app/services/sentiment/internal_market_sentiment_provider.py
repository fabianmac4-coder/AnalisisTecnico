"""Proveedor interno de sentimiento (proxy Fear & Greed).

Pondera VIX, tendencia de S&P 500 / NASDAQ / Russell 2000, breadth de movers y
tono de noticias. Si falta un componente, redistribuye su peso entre los
disponibles y baja la confianza. NO es el índice oficial de CNN.
"""
from __future__ import annotations

from app.services.sentiment.sentiment_provider_base import SentimentProvider
from app.services.sentiment.sentiment_types import (
    NEGATIVE,
    NEUTRAL,
    POSITIVE,
    IndexTrendInput,
    SentimentComponent,
    SentimentInputs,
    SentimentResult,
    label_for_score,
)

SRC_MARKET = "Yahoo Finance"
SRC_MOVERS = "Market Movers"
SRC_NEWS = "News Module"

# Pesos base (suman 100); se redistribuyen entre los componentes disponibles.
WEIGHTS = {
    "vix": 30.0,
    "sp500": 25.0,
    "nasdaq": 15.0,
    "russell": 10.0,
    "breadth": 10.0,
    "news": 10.0,
}


def _status_for(score: float) -> str:
    if score >= 56:
        return POSITIVE
    if score <= 44:
        return NEGATIVE
    return NEUTRAL


def _vix_score(vix: float) -> tuple[float, str]:
    if vix < 16:
        return 75.0, "Volatilidad baja: apetito de riesgo."
    if vix < 24:
        return 55.0, "Volatilidad normal."
    if vix <= 30:
        return 35.0, "Volatilidad elevada: cautela."
    return 20.0, "Volatilidad muy alta: aversión al riesgo."


def _trend_score(idx: IndexTrendInput) -> tuple[float, str] | None:
    cp = idx.change_percent
    if cp is None and idx.last_close is None:
        return None
    above_avg = (
        idx.last_close is not None
        and idx.short_avg is not None
        and idx.last_close > idx.short_avg
    )
    if cp is not None and cp > 0.05:
        if above_avg:
            return 70.0, f"{idx.name} al alza y sobre su promedio corto."
        return 62.0, f"{idx.name} al alza hoy."
    if cp is not None and cp < -0.05:
        return 35.0, f"{idx.name} a la baja hoy."
    return 50.0, f"{idx.name} plano."


class InternalMarketSentimentProvider(SentimentProvider):
    name = "internal_market_sentiment_provider"

    def compute(self, inputs: SentimentInputs) -> SentimentResult:
        components: list[SentimentComponent] = []

        if inputs.vix is not None:
            score, exp = _vix_score(inputs.vix)
            components.append(SentimentComponent(
                "VIX", score, _status_for(score), inputs.vix, SRC_MARKET,
                WEIGHTS["vix"], exp))

        for key, idx in (
            ("sp500", inputs.sp500),
            ("nasdaq", inputs.nasdaq),
            ("russell", inputs.russell),
        ):
            if idx is None:
                continue
            res = _trend_score(idx)
            if res is None:
                continue
            score, exp = res
            components.append(SentimentComponent(
                idx.name, score, _status_for(score), idx.change_percent,
                SRC_MARKET, WEIGHTS[key], exp))

        if inputs.gainers_count is not None and inputs.losers_count is not None:
            g, ls = inputs.gainers_count, inputs.losers_count
            if g > ls:
                score, exp = 65.0, "Más valores subiendo que bajando (breadth positiva)."
            elif g < ls:
                score, exp = 35.0, "Más valores bajando que subiendo (breadth negativa)."
            else:
                score, exp = 50.0, "Breadth equilibrada."
            components.append(SentimentComponent(
                "Breadth de movers", score, _status_for(score), float(g - ls),
                SRC_MOVERS, WEIGHTS["breadth"], exp))

        if inputs.news_tone is not None:
            tone = max(-1.0, min(1.0, inputs.news_tone))
            score = 50.0 + tone * 25.0
            exp = (
                "Tono de titulares positivo." if tone > 0.1
                else "Tono de titulares negativo." if tone < -0.1
                else "Tono de titulares neutral."
            )
            components.append(SentimentComponent(
                "Tono de noticias", score, _status_for(score), round(tone, 2),
                SRC_NEWS, WEIGHTS["news"], exp))

        warnings: list[str] = []
        if not components:
            return SentimentResult(
                score=None, label="UNAVAILABLE", confidence="LOW",
                source=self.name, components=[],
                warnings=["Market sentiment data is limited."])

        total_weight = sum(c.weight for c in components)
        weighted = sum(c.score * c.weight for c in components) / total_weight
        overall = round(max(0.0, min(100.0, weighted)))

        # Confianza por cobertura de peso (de 100). Sin VIX, tope MEDIUM.
        has_vix = any(c.name == "VIX" for c in components)
        if total_weight >= 85 and has_vix:
            confidence = "HIGH"
        elif total_weight >= 55:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"
        if not has_vix and confidence == "HIGH":
            confidence = "MEDIUM"

        if total_weight < 100:
            warnings.append("Some sentiment components were unavailable; weights redistributed.")

        return SentimentResult(
            score=overall,
            label=label_for_score(overall),
            confidence=confidence,
            source=self.name,
            components=components,
            warnings=warnings,
        )
