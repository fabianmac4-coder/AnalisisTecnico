"""Proveedor FRED (St. Louis Fed) para indicadores macro de EE.UU.

OPCIONAL: requiere FRED_API_KEY. Sin clave, `available()` es False y el servicio
marca esos indicadores como MISSING con un warning. Best-effort: cualquier fallo
de red devuelve datos parciales, nunca lanza.
"""
from __future__ import annotations

import os

import httpx

from app.config import env_settings
from app.services.macro import macro_types as t
from app.services.macro.macro_provider_base import MacroIndicatorProvider

# (series_id, units, label, good_direction, formato). good_direction: "down" si
# bajar es POSITIVO (inflación, paro), "up" si subir es POSITIVO (GDP, confianza).
# units FRED: "lin" nivel, "pc1" % vs hace 1 año, "chg" cambio vs periodo previo.
# (series_id_default, units, label, good_direction, formato). El series_id de
# `industrialProduction`/`retailSales` se puede sobreescribir por env (ver
# ENV_SERIES_OVERRIDE). good_direction "up" = subir es POSITIVO.
SERIES = {
    "fedFundsRate": ("FEDFUNDS", "lin", "Tasa de Fondos Federales", "down", "pct"),
    "cpi": ("CPIAUCSL", "pc1", "Inflación CPI (interanual)", "down", "pct"),
    "pce": ("PCEPI", "pc1", "Inflación PCE (interanual)", "down", "pct"),
    "unemploymentRate": ("UNRATE", "lin", "Tasa de desempleo", "down", "pct"),
    "nonFarmPayrolls": ("PAYEMS", "chg", "Nóminas no agrícolas (cambio)", "up", "thousands"),
    "gdpGrowth": ("A191RL1Q225SBEA", "lin", "Crecimiento del PIB (real)", "up", "pct"),
    "industrialProduction": ("INDPRO", "lin", "Producción industrial", "up", "index"),
    "retailSales": ("RSAFS", "lin", "Ventas minoristas", "up", "usd_millions_to_b"),
    "consumerConfidence": ("UMCSENT", "lin", "Confianza del consumidor (UMich)", "up", "index"),
}
# Series cuyo id se puede sobreescribir por variable de entorno.
ENV_SERIES_OVERRIDE = {
    "industrialProduction": "FRED_SERIES_INDUSTRIAL_PRODUCTION",
    "retailSales": "FRED_SERIES_RETAIL_SALES",
}
# Series de nivel donde tiene sentido reportar changePercent.
PERCENT_CHANGE_KEYS = {"industrialProduction", "retailSales"}

_UA = {"User-Agent": "TradingAnalysisPlatform/1.0"}


def _verify():
    """CA bundle de Windows (proxy TLS) si está disponible; si no, certifi (True)."""
    return os.environ.get("SSL_CERT_FILE") or True


def _fmt(value: float | None, kind: str) -> str:
    if value is None:
        return "Unavailable"
    if kind == "pct":
        return f"{value:.1f}%"
    if kind == "thousands":
        return f"{value:+,.0f}K"
    if kind == "index":
        return f"{value:,.2f}"
    if kind == "usd_millions_to_b":
        # RSAFS viene en millones de USD -> se muestra en miles de millones.
        return f"${value / 1000:,.1f}B"
    return f"{value:,.1f}"


def _trend_status(change: float | None, good_direction: str) -> tuple[str, str]:
    if change is None:
        return t.UNKNOWN, t.NEUTRAL
    if abs(change) < 1e-9:
        return t.STABLE, t.NEUTRAL
    improving = (change < 0) if good_direction == "down" else (change > 0)
    if improving:
        return t.IMPROVING, t.POSITIVE
    return t.WORSENING, t.NEGATIVE


class FredProvider(MacroIndicatorProvider):
    name = "FRED"

    def available(self) -> bool:
        return bool(env_settings.FRED_API_KEY)

    def _fred_get(self, path: str, **params) -> dict:
        """GET genérico al API de FRED (api_key + json + CA bundle del proxy)."""
        params.update(api_key=env_settings.FRED_API_KEY, file_type="json")
        url = f"{env_settings.FRED_API_BASE_URL.rstrip('/')}/{path}"
        resp = httpx.get(url, params=params, timeout=15.0, headers=_UA, verify=_verify())
        resp.raise_for_status()
        return resp.json()

    def _series_latest(self, series_id: str, units: str) -> tuple[float | None, float | None, str | None]:
        """(latest, previous, date) de las 2 observaciones más recientes."""
        url = f"{env_settings.FRED_API_BASE_URL.rstrip('/')}/series/observations"
        params = {
            "series_id": series_id,
            "api_key": env_settings.FRED_API_KEY,
            "file_type": "json",
            "units": units,
            "sort_order": "desc",
            "limit": 5,
        }
        resp = httpx.get(url, params=params, timeout=10.0, headers=_UA, verify=_verify())
        resp.raise_for_status()
        obs = resp.json().get("observations", [])
        vals: list[tuple[float, str]] = []
        for o in obs:
            raw = o.get("value")
            if raw in (None, "", "."):
                continue
            try:
                vals.append((float(raw), o.get("date")))
            except (TypeError, ValueError):
                continue
        if not vals:
            return None, None, None
        latest, date = vals[0]
        previous = vals[1][0] if len(vals) > 1 else None
        return latest, previous, date

    def latest_value(self, series_id: str, units: str = "lin") -> tuple[float | None, str | None]:
        """Último valor de una serie (p. ej. DGS2 para el Tesoro 2 años). Best-effort."""
        if not self.available():
            return None, None
        try:
            latest, _prev, date = self._series_latest(series_id, units)
            return latest, date
        except Exception:  # noqa: BLE001
            return None, None

    def _series_id_for(self, key: str, default: str) -> str:
        """Resuelve el series_id (env override si existe, p. ej. INDPRO/RSAFS)."""
        env_name = ENV_SERIES_OVERRIDE.get(key)
        if env_name:
            configured = getattr(env_settings, env_name, "") or ""
            if configured:
                return configured
        return default

    def fetch_indicators(self) -> tuple[dict, list[str]]:
        out: dict = {}
        warnings: list[str] = []
        if not self.available():
            for key, (_, _, label, _, _) in SERIES.items():
                out[key] = t.missing_indicator(key, label, source="FRED")
            warnings.append(
                "FRED API key is not configured. Some macro indicators are unavailable."
            )
            return out, warnings

        for key, (default_id, units, label, good_dir, fmt_kind) in SERIES.items():
            series_id = self._series_id_for(key, default_id)
            try:
                latest, prev, date = self._series_latest(series_id, units)
            except Exception:  # noqa: BLE001
                out[key] = t.missing_indicator(key, label, source="FRED")
                warnings.append(f"FRED indicator unavailable: {key}.")
                continue
            if latest is None:
                out[key] = t.missing_indicator(key, label, source="FRED")
                continue
            change = (latest - prev) if prev is not None else None
            trend, status = _trend_status(change, good_dir)
            extra = None
            if key in PERCENT_CHANGE_KEYS and prev not in (None, 0):
                extra = {"changePercent": round(change / prev * 100, 2)}
            out[key] = t.indicator(
                key, label, round(latest, 2),
                display_value=_fmt(latest, fmt_kind),
                previous_value=round(prev, 2) if prev is not None else None,
                change=round(change, 2) if change is not None else None,
                trend=trend, status=status, source="FRED", last_updated=date,
                explanation=_explain(key, trend), extra=extra,
            )
        return out, warnings

    def resolve_release_id(self, keywords: list[str]) -> int | None:
        """Re-resuelve un release_id desde fred/releases por keyword (fallback)."""
        try:
            data = self._fred_get("releases", limit=1000)
        except Exception:  # noqa: BLE001
            return None
        for rel in data.get("releases", []):
            name = (rel.get("name") or "").lower()
            if any(kw.lower() in name for kw in keywords):
                rid = rel.get("id")
                return int(rid) if rid is not None else None
        return None

    def fetch_release_dates(
        self, release_id: int, start_iso: str, end_iso: str, limit: int = 24
    ) -> list[str]:
        """Fechas de publicación futuras (start..end) de un release. Best-effort."""
        try:
            data = self._fred_get(
                "release/dates", release_id=release_id,
                include_release_dates_with_no_data="true", sort_order="asc",
                realtime_start=start_iso, limit=limit,
            )
        except Exception:  # noqa: BLE001
            return []
        dates = [
            d["date"] for d in data.get("release_dates", [])
            if d.get("date") and start_iso <= d["date"] <= end_iso
        ]
        return sorted(set(dates))


def _explain(key: str, trend: str) -> str:
    base = {
        "fedFundsRate": "La política de tasas de la Fed",
        "cpi": "La inflación CPI",
        "pce": "La inflación PCE (medida preferida de la Fed)",
        "unemploymentRate": "El desempleo",
        "nonFarmPayrolls": "La creación de empleo",
        "gdpGrowth": "El crecimiento económico",
        "industrialProduction": "La producción industrial",
        "retailSales": "Las ventas minoristas",
        "consumerConfidence": "La confianza del consumidor",
    }.get(key, "El indicador")
    if trend == t.IMPROVING:
        return f"{base} mejora respecto a la lectura previa."
    if trend == t.WORSENING:
        return f"{base} empeora respecto a la lectura previa."
    if trend == t.STABLE:
        return f"{base} se mantiene estable."
    return f"{base} sin variación clara."
