"""Calendario económico basado en las FECHAS DE PUBLICACIÓN de FRED.

Cuando hay `FRED_API_KEY`, resuelve los próximos releases importantes (CPI, NFP,
GDP, PCE, FOMC, retail, sentimiento) vía `fred/release/dates`. Si FRED no está o
no devuelve nada, marca el calendario como NO DISPONIBLE (la UI lo oculta en vez
de mostrar un panel grande vacío). NUNCA inventa fechas.

Aviso importante: las fechas de FRED las publican las fuentes de cada dato y no
garantizan que el dato esté disponible en FRED en ese instante exacto.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.repositories.market_cache_repository import MarketCacheRepository
from app.services.macro.fred_provider import FredProvider
from app.services.macro.fred_release_config import IMPORTANT_FRED_RELEASES

CAL_WINDOW_DAYS = 60
CAL_MAX_EVENTS = 10
RELEASE_ID_CACHE_TYPE = "FRED_RELEASE_IDS"
RELEASE_ID_CACHE_KEY = "global"
_RELEASE_NOTE = (
    "Fecha de publicación de FRED; puede no coincidir con el momento exacto en "
    "que el dato queda disponible."
)


def build_calendar(
    db: Session | None, force_refresh: bool = False
) -> tuple[list[dict], list[str], bool, str]:
    """(events, warnings, available, source). Best-effort; nunca lanza."""
    fred = FredProvider()
    if not fred.available():
        return (
            [],
            ["Economic calendar provider is not configured (FRED API key missing)."],
            False,
            "UNAVAILABLE",
        )

    today = date.today()
    start = today.isoformat()
    end = (today + timedelta(days=CAL_WINDOW_DAYS)).isoformat()
    warnings: list[str] = []

    repo = MarketCacheRepository(db) if db is not None else None
    id_map: dict = {}
    if repo is not None:
        id_map = repo.get_latest_any(RELEASE_ID_CACHE_TYPE, RELEASE_ID_CACHE_KEY) or {}
    id_map_changed = False

    events: list[dict] = []
    for rel in IMPORTANT_FRED_RELEASES:
        key = rel["key"]
        rid = id_map.get(key) or rel["fred_release_id"]
        try:
            dates = fred.fetch_release_dates(rid, start, end)
        except Exception:  # noqa: BLE001
            dates = []
        if not dates:
            # Fallback: re-resolver el release_id por keyword.
            new_id = fred.resolve_release_id(rel["keywords"])
            if new_id and new_id != rid:
                id_map[key] = new_id
                id_map_changed = True
                try:
                    dates = fred.fetch_release_dates(new_id, start, end)
                except Exception:  # noqa: BLE001
                    dates = []
        for d in dates[:2]:
            events.append({
                "eventName": rel["displayName"],
                "date": d,
                "time": None,
                "country": "US",
                "impact": rel["impact"],
                "consensus": None,
                "previous": None,
                "source": "FRED",
                "notes": _RELEASE_NOTE,
            })

    events.sort(key=lambda e: e["date"])
    events = events[:CAL_MAX_EVENTS]

    if id_map_changed and repo is not None:
        try:
            repo.store(RELEASE_ID_CACHE_TYPE, "FRED", RELEASE_ID_CACHE_KEY,
                       id_map, 60 * 24 * 7)
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()

    if not events:
        warnings.append("Economic calendar data is not available from FRED right now.")
        return [], warnings, False, "UNAVAILABLE"
    return events, warnings, True, "FRED"
