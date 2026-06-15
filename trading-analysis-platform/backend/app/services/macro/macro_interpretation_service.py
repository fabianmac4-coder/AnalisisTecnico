"""Interpretación macro basada en reglas (sin IA): curva, riesgo y explicación."""
from __future__ import annotations

from app.services.macro import macro_types as t


def yield_curve_status(spread_10_2: float | None) -> str:
    if spread_10_2 is None:
        return t.CURVE_UNKNOWN
    if spread_10_2 > 0.50:
        return t.CURVE_NORMAL
    if spread_10_2 < 0.0:
        return t.CURVE_INVERTED
    return t.CURVE_FLAT


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def compute_risk(
    usa: dict,
    rates: dict,
    sentiment: dict | None,
) -> dict:
    """Riesgo macro GREEN/YELLOW/RED/UNKNOWN (score: mayor = más riesgo)."""
    score = 50.0
    drivers: list[str] = []
    risks: list[str] = []
    signals = 0

    cpi = usa.get("cpi")
    if cpi and cpi.get("status") != t.MISSING:
        signals += 1
        if cpi.get("trend") == t.WORSENING:
            score += 12
            risks.append("La inflación está empeorando")
        elif cpi.get("trend") == t.IMPROVING:
            score -= 10
            drivers.append("La tendencia de inflación está mejorando")

    ff = usa.get("fedFundsRate")
    if ff and ff.get("value") is not None:
        signals += 1
        if ff["value"] >= 4.5:
            score += 10
            drivers.append("Las tasas siguen restrictivas")
        elif ff["value"] <= 2.5:
            score -= 6

    un = usa.get("unemploymentRate")
    if un and un.get("status") != t.MISSING:
        signals += 1
        if un.get("trend") == t.WORSENING:
            score += 10
            risks.append("El mercado laboral se está debilitando")

    gdp = usa.get("gdpGrowth")
    if gdp and gdp.get("status") != t.MISSING:
        signals += 1
        if gdp.get("trend") == t.WORSENING:
            score += 8
            risks.append("El crecimiento se está desacelerando")
        elif gdp.get("trend") == t.IMPROVING:
            score -= 6

    curve = rates.get("curveStatus")
    if curve and curve != t.CURVE_UNKNOWN:
        signals += 1
        if curve == t.CURVE_INVERTED:
            score += 12
            drivers.append("La curva de rendimientos está invertida")
        elif curve == t.CURVE_FLAT:
            score += 5
            drivers.append("La curva de rendimientos está plana")

    if sentiment and sentiment.get("score") is not None:
        signals += 1
        s = sentiment["score"]
        if s <= 30:
            score += 10
            risks.append("El sentimiento de mercado es temeroso")
        elif s >= 70:
            score -= 4
        for c in sentiment.get("components", []) or []:
            if c.get("name") == "VIX" and c.get("value") is not None and c["value"] > 26:
                score += 8
                risks.append("El VIX está elevado")

    score = round(_clamp(score, 0, 100))
    if signals < 2:
        level = t.RISK_UNKNOWN
    elif score >= 70:
        level = t.RED
    elif score >= 40:
        level = t.YELLOW
    else:
        level = t.GREEN

    if not risks and level in (t.YELLOW, t.RED):
        risks.append("Las acciones de valuación alta pueden ser sensibles a las tasas")
    return {"riskLevel": level, "score": score, "drivers": drivers[:5], "risks": risks[:5]}


RISK_LABELS = {
    t.GREEN: "Riesgo macro bajo",
    t.YELLOW: "Riesgo macro moderado",
    t.RED: "Riesgo macro elevado",
    t.RISK_UNKNOWN: "Datos macro insuficientes",
}


def executive_summary(risk: dict, last_updated: str) -> dict:
    level = risk["riskLevel"]
    drivers = risk.get("drivers", [])
    base = {
        t.GREEN: "El entorno macro luce constructivo.",
        t.YELLOW: "El entorno macro es mixto: condiciones restrictivas conviven con mejoras parciales.",
        t.RED: "El entorno macro muestra estrés: conviene mayor cautela.",
        t.RISK_UNKNOWN: "No hay datos macro suficientes para una lectura clara.",
    }[level]
    if drivers:
        base += " " + "; ".join(drivers[:3]) + "."
    return {
        "riskLevel": level,
        "riskLabel": RISK_LABELS[level],
        "summary": base,
        "lastUpdated": last_updated,
    }


def what_this_means(risk: dict, usa: dict, rates: dict) -> list[str]:
    bullets: list[str] = []
    ff = usa.get("fedFundsRate")
    if ff and ff.get("value") is not None and ff["value"] >= 4.5:
        bullets.append(
            "Si las tasas siguen altas, las empresas con valuaciones muy elevadas pueden "
            "ser más sensibles a correcciones."
        )
    cpi = usa.get("cpi")
    if cpi and cpi.get("trend") == t.IMPROVING:
        bullets.append(
            "Si la inflación sigue bajando, el mercado puede anticipar recortes de tasas "
            "y favorecer a las acciones de crecimiento."
        )
    elif cpi and cpi.get("trend") == t.WORSENING:
        bullets.append(
            "Si la inflación repunta, puede retrasar los recortes de tasas y presionar "
            "la valuación de las acciones."
        )
    curve = rates.get("curveStatus")
    if curve == t.CURVE_INVERTED:
        bullets.append(
            "Una curva invertida no predice el momento exacto, pero sí sugiere cautela "
            "sobre escenarios de crecimiento."
        )
    elif curve == t.CURVE_NORMAL:
        bullets.append("Una curva normal suele ser más saludable para la expansión económica.")
    if risk["riskLevel"] == t.RED:
        bullets.append("Con riesgo macro elevado, prioriza la gestión de riesgo sobre perseguir entradas.")
    bullets.append("Combina esta lectura macro con el Scorecard y el análisis técnico de cada acción.")
    bullets.append("No uses un solo dato macro como señal de compra o venta.")
    return bullets[:6]
