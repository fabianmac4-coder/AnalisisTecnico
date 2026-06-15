"""Orquestador del Macro Dashboard (Fase 3).

Agrega, best-effort y con cache en C080: indicadores de EE.UU. (FRED opcional),
tasas/curva (FRED 2A + Yahoo 5/10/30A), mercados globales (Yahoo), calendario
(opcional), riesgo macro, resumen ejecutivo y "qué significa". Reutiliza el cache
de sentimiento de Fase 2 (C080) para el componente de riesgo. Nunca lanza.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import env_settings
from app.repositories.market_cache_repository import MarketCacheRepository
from app.services.macro import economic_calendar_provider as cal
from app.services.macro import macro_interpretation_service as interp
from app.services.macro import macro_types as t
from app.services.macro import yahoo_macro_provider as ymp
from app.services.macro.fred_provider import FredProvider

CACHE_TYPE = "MACRO_OVERVIEW"
CACHE_KEY = "global"
PROVIDER = "macro_service"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cached_sentiment(db: Session) -> dict | None:
    try:
        return MarketCacheRepository(db).get_latest_any("MARKET_SENTIMENT", "global")
    except Exception:  # noqa: BLE001
        return None


def _build_rates(warnings: list[str]) -> dict:
    treasuries, w = ymp.fetch_treasuries()  # 5/10/30A
    warnings.extend(w)
    fred = FredProvider()
    two_y, two_date = (None, None)
    if fred.available():
        two_y, two_date = fred.latest_value("DGS2")
    if two_y is not None:
        treasuries["treasury2Y"] = t.indicator(
            "treasury2Y", "Tesoro 2 años", round(two_y, 3),
            display_value=f"{two_y:.2f}%", source="FRED", last_updated=two_date)
    else:
        treasuries["treasury2Y"] = t.missing_indicator(
            "treasury2Y", "Tesoro 2 años", source="FRED")

    ten = treasuries.get("treasury10Y", {}).get("value")
    two = treasuries.get("treasury2Y", {}).get("value")
    spread = (ten - two) if (ten is not None and two is not None) else None
    curve = interp.yield_curve_status(spread)
    curve_exp = {
        t.CURVE_INVERTED: "Una curva invertida puede sugerir preocupación sobre el crecimiento futuro.",
        t.CURVE_NORMAL: "Una curva normal suele ser más saludable para la expansión económica.",
        t.CURVE_FLAT: "Una curva plana sugiere incertidumbre sobre tasas y crecimiento.",
        t.CURVE_UNKNOWN: "Datos insuficientes para evaluar la curva (falta el tramo 2 años).",
    }[curve]
    treasuries["yieldCurve10Y2Y"] = t.indicator(
        "yieldCurve10Y2Y", "Spread 10A - 2A",
        round(spread, 2) if spread is not None else None,
        display_value=f"{spread:+.2f}%" if spread is not None else "Unavailable",
        status=t.NEGATIVE if curve == t.CURVE_INVERTED else t.NEUTRAL,
        source="FRED/Yahoo", explanation=curve_exp,
    )
    treasuries["curveStatus"] = curve
    return treasuries


def get_overview(db: Session, force_refresh: bool = False) -> dict:
    """Overview macro agregado con cache C080. Nunca lanza."""
    repo = MarketCacheRepository(db)
    if not force_refresh:
        cached = repo.get_fresh(CACHE_TYPE, CACHE_KEY)
        if cached is not None:
            cached["fromCache"] = True
            return cached

    warnings: list[str] = []

    # 1. Indicadores EE.UU. (FRED opcional -> MISSING + warning si no hay clave).
    fred = FredProvider()
    usa, usa_warn = fred.fetch_indicators()
    warnings.extend(usa_warn)

    # 2. Tasas + curva.
    rates = _build_rates(warnings)

    # 3. Mercados globales (Yahoo).
    global_markets, gm_warn = ymp.fetch_global_markets()
    warnings.extend(gm_warn)

    # 4. Calendario económico (FRED release dates si hay clave).
    calendar, cal_warn, cal_available, cal_source = cal.build_calendar(
        db, force_refresh
    )
    warnings.extend(cal_warn)

    # 5. Riesgo (reutiliza el sentimiento cacheado de Fase 2).
    sentiment = _cached_sentiment(db)
    risk = interp.compute_risk(usa, rates, sentiment)
    now = _now_iso()
    executive = interp.executive_summary(risk, now)
    what = interp.what_this_means(risk, usa, rates)

    rates_available = any(
        isinstance(v, dict) and v.get("value") is not None
        for v in rates.values()
    )
    gm_available = bool(
        global_markets["fx"] or global_markets["commodities"] or global_markets["crypto"]
    )

    overview = {
        "executiveSummary": executive,
        "macroRisk": risk,
        "usaIndicators": usa,
        "rates": rates,
        "globalMarkets": global_markets,
        "economicCalendar": calendar,
        "economicCalendarAvailable": cal_available,
        "economicCalendarSource": cal_source,
        "whatThisMeans": what,
        "dataAvailability": {
            "macroProviderConfigured": fred.available(),
            "ratesAvailable": rates_available,
            "globalMarketsAvailable": gm_available,
            "calendarAvailable": cal_available,
        },
        "warnings": warnings,
        "lastUpdated": now,
        "fromCache": False,
    }

    has_data = rates_available or gm_available or any(
        v.get("status") != t.MISSING for v in usa.values()
    )
    if has_data:
        try:
            repo.store(CACHE_TYPE, PROVIDER, CACHE_KEY, overview,
                       env_settings.MACRO_CACHE_TTL_MINUTES)
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
        return overview

    stale = repo.get_latest_any(CACHE_TYPE, CACHE_KEY)
    if stale is not None:
        stale["fromCache"] = True
        stale.setdefault("warnings", []).append(
            "Could not refresh macro data. Showing cached data."
        )
        return stale
    overview["warnings"].append("Macro data is partially available.")
    return overview


def get_macro_context(db: Session) -> dict | None:
    """Resumen macro COMPACTO desde el cache C080 (sin red). None si no hay cache.

    Lo consumen el Stock Scorecard y el AI Chat: si la página macro no se ha
    cargado, no hay contexto y nada falla.
    """
    repo = MarketCacheRepository(db)
    cached = repo.get_fresh(CACHE_TYPE, CACHE_KEY) or repo.get_latest_any(
        CACHE_TYPE, CACHE_KEY)
    if not cached:
        return None
    ex = cached.get("executiveSummary", {})
    rates = cached.get("rates", {})
    usa = cached.get("usaIndicators", {})
    cpi = usa.get("cpi", {}) if isinstance(usa, dict) else {}
    return {
        "riskLevel": ex.get("riskLevel"),
        "riskLabel": ex.get("riskLabel"),
        "summary": ex.get("summary"),
        "yieldCurveStatus": rates.get("curveStatus"),
        "inflationTrend": cpi.get("trend"),
        "warnings": (cached.get("warnings") or [])[:3],
    }
