"""Construye el contexto del instrumento activo para el chat de IA.

Reglas:
- Conciso: limites de dibujos/noticias; resumenes en lugar de JSON gigantes.
- Seguro: JAMAS incluye PasswordHash, tokens, JWTs ni datos de otros usuarios.
- Robusto: cada seccion captura sus propios errores (mercado caido, noticias
  no disponibles, etc.) y lo declara en el contexto en lugar de romper el chat.
"""
from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from datetime import datetime, timezone

from app.config import env_settings
from app.models import Usuario
from app.repositories.catalogo_repository import CatalogoRepository
from app.repositories.dibujos_repository import DibujosRepository
from app.repositories.indicadores_repository import IndicadoresRepository
from app.services import news_service
from app.services.indicator_service import bollinger, ema, macd, rsi, sma

logger = logging.getLogger("ai_context")


def _ms_to_date(ms: float | int | None) -> str | None:
    """Unix ms UTC -> 'YYYY-MM-DD' (para que el modelo entienda fechas)."""
    if ms is None:
        return None
    try:
        return datetime.fromtimestamp(float(ms) / 1000, tz=timezone.utc).strftime(
            "%Y-%m-%d"
        )
    except (OverflowError, OSError, ValueError):
        return None


def _safe_json(value: str | None, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _market_summary(symbol: str) -> dict:
    """Precio canonico + resumen diario (1Y_1D) usando el servicio existente.

    Pide ~260 velas de WARMUP ademas del año visible para que SMA200/EMA/RSI
    converjan con precision (mismos datos crudos de Yahoo que las graficas).
    """
    from app.services import yahoo_service

    summary: dict = {"market_data_available": True}
    try:
        quote = yahoo_service.get_quote(symbol)
        summary["quote"] = {
            "price": quote.price,
            "change": quote.change,
            "changePercent": quote.changePercent,
            "currency": quote.currency,
            "marketState": quote.marketState,
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sin cotizacion de %s: %s", symbol, type(exc).__name__)
        summary["market_data_available"] = False
        return summary

    try:
        ohlcv = yahoo_service.get_ohlcv(
            symbol, "1Y_1D", include_warmup=True, warmup_bars=260
        )
        bars = ohlcv.bars
        warmup = ohlcv.warmupBars or []
        if bars:
            closes = [b.close for b in bars]
            highs = [b.high for b in bars]
            lows = [b.low for b in bars]
            last = bars[-1]
            summary["asOf"] = _ms_to_date(last.time)
            summary["daily_1y"] = {
                "bars": len(bars),
                "lastClose": last.close,
                "lastBarDate": _ms_to_date(last.time),
                "yearHigh": max(highs),
                "yearLow": min(lows),
                "high20d": max(highs[-20:]),
                "low20d": min(lows[-20:]),
                "changePercent20d": round(
                    (closes[-1] / closes[-20] - 1) * 100, 2
                )
                if len(closes) >= 20 and closes[-20]
                else None,
            }
            # Interno: series COMPLETAS (warmup + visibles) para indicadores.
            full = [*warmup, *bars]
            summary["_closes_1d"] = [b.close for b in full]
            summary["_volumes_1d"] = [b.volume for b in full]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sin OHLCV de %s: %s", symbol, type(exc).__name__)
    return summary


def _weekly_summary(symbol: str) -> dict | None:
    """Contexto semanal (4Y_1W): cierre, RSI14 y SMA 10/40 semanas."""
    from app.services import yahoo_service

    try:
        ohlcv = yahoo_service.get_ohlcv(symbol, "4Y_1W")
        bars = ohlcv.bars
        if not bars:
            return None
        closes = [b.close for b in bars]
        return {
            "lastClose": bars[-1].close,
            "lastBarDate": _ms_to_date(bars[-1].time),
            "rsi14w": _last_value(rsi(closes, 14)),
            "sma10w": _last_value(sma(closes, 10)),
            "sma40w": _last_value(sma(closes, 40)),
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sin semanal de %s: %s", symbol, type(exc).__name__)
        return None


def _last_value(series: list[float | None]) -> float | None:
    for value in reversed(series):
        if value is not None:
            return round(value, 4)
    return None


def _indicator_values(
    closes: list[float], volumes: list[float | None] | None = None
) -> dict:
    """Valores actuales (sobre cierres diarios con warmup) de los clasicos."""
    if not closes:
        return {}
    macd_line, macd_signal, macd_hist = macd(closes, 12, 26, 9)
    bb_up, bb_mid, bb_low = bollinger(closes, 20, 2.0)
    values = {
        "sma20": _last_value(sma(closes, 20)),
        "sma50": _last_value(sma(closes, 50)),
        "sma200": _last_value(sma(closes, 200)),
        "ema9": _last_value(ema(closes, 9)),
        "ema20": _last_value(ema(closes, 20)),
        "ema21": _last_value(ema(closes, 21)),
        "ema50": _last_value(ema(closes, 50)),
        "ema200": _last_value(ema(closes, 200)),
        "rsi14": _last_value(rsi(closes, 14)),
        "macd": _last_value(macd_line),
        "macdSignal": _last_value(macd_signal),
        "macdHist": _last_value(macd_hist),
        "bbUpper": _last_value(bb_up),
        "bbMiddle": _last_value(bb_mid),
        "bbLower": _last_value(bb_low),
    }
    vols = [v for v in (volumes or []) if v is not None]
    if vols:
        values["volumeLast"] = round(vols[-1], 0)
        if len(vols) >= 20:
            values["volumeAvg20"] = round(sum(vols[-20:]) / 20, 0)
    return {k: v for k, v in values.items() if v is not None}


def _configured_indicator_values(configs: list[dict], closes: list[float]) -> dict:
    """Valores de los indicadores que el usuario tiene VISIBLES, calculados
    con SUS parametros (los mismos que ve en pantalla, sobre cierres diarios).
    """
    out: dict = {}
    if not closes:
        return out
    for cfg in configs:
        if not cfg.get("visible"):
            continue
        tipo = str(cfg.get("type", "")).upper()
        params = cfg.get("params", {}) or {}
        cid = cfg.get("id", tipo)
        try:
            if tipo == "SMA":
                period = int(params.get("period", 20))
                out[cid] = _last_value(sma(closes, period))
            elif tipo == "EMA":
                period = int(params.get("period", 21))
                out[cid] = _last_value(ema(closes, period))
            elif tipo == "RSI":
                period = int(params.get("period", 14))
                out[cid] = _last_value(rsi(closes, period))
            elif tipo == "MACD":
                fast = int(params.get("fastPeriod", params.get("fast", 12)))
                slow = int(params.get("slowPeriod", params.get("slow", 26)))
                sig = int(params.get("signalPeriod", params.get("signal", 9)))
                line, signal, hist = macd(closes, fast, slow, sig)
                out[cid] = {
                    "line": _last_value(line),
                    "signal": _last_value(signal),
                    "histogram": _last_value(hist),
                }
            elif tipo in ("BBANDS", "BOLLINGER"):
                period = int(params.get("period", 20))
                mult = float(params.get("stdDev", params.get("multiplier", 2)))
                up, mid, low = bollinger(closes, period, mult)
                out[cid] = {
                    "upper": _last_value(up),
                    "middle": _last_value(mid),
                    "lower": _last_value(low),
                }
        except (TypeError, ValueError):  # params corruptos: omitir ese indicador
            continue
    return {k: v for k, v in out.items() if v is not None}


def _simulated_entries(
    db: Session, user_id: int, c010_id: int | None, current_price: float | None
) -> list[dict]:
    """Entradas simuladas (paper trading) del usuario para el instrumento.

    Analisis HIPOTETICO: jamas se presenta como operacion real.
    """
    if c010_id is None:
        return []
    try:
        from app.repositories.operaciones_simuladas_repository import (
            OperacionesSimuladasRepository,
            calculate_performance,
        )

        ops = OperacionesSimuladasRepository(db).list_by_user_and_action(
            user_id, c010_id
        )
        out: list[dict] = []
        for op in ops:
            if not op.Visible:
                continue
            perf = calculate_performance(op, current_price)
            out.append(
                {
                    "type": op.TipoOperacion,
                    "status": op.Estado,
                    "entryPrice": float(op.PrecioEntrada),
                    "entryDate": op.FechaEntrada.isoformat(),
                    "quantity": float(op.Cantidad) if op.Cantidad is not None else None,
                    "name": op.NombreOperacion,
                    "notes": op.Notas,
                    "currentPrice": perf["currentPrice"],
                    "gainLossPercent": perf["gainLossPercent"],
                    "daysSinceEntry": perf["daysSinceEntry"],
                }
            )
        return out
    except Exception as exc:  # noqa: BLE001 - nunca rompe el contexto
        logger.warning("Sin entradas simuladas: %s", type(exc).__name__)
        return []


def _cached_global_headlines(
    db: Session, limit: int = 3, trending_only: bool = False
) -> list[dict]:
    """Titulares globales/trending desde el CACHE SQL (sin llamadas externas)."""
    try:
        from app.repositories.noticias_repository import NoticiasRepository
        from app.services.news.news_types import CATEGORY_TRENDING

        rows = NoticiasRepository(db).list_global_news(
            category=CATEGORY_TRENDING if trending_only else None, limit=limit
        )
        return [
            {
                "title": r.Titulo,
                "publisher": r.Publisher,
                "publishedAt": r.FechaPublicacion.isoformat()
                if r.FechaPublicacion
                else None,
            }
            for r in rows
        ]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sin titulares globales cacheados: %s", type(exc).__name__)
        return []


def _summarize_drawing(row) -> dict:
    points = _safe_json(row.PuntosJSON, [])
    compact_points = [
        {
            "time": p.get("time"),
            "date": _ms_to_date(p.get("time")),
            "price": p.get("price"),
        }
        for p in points
        if isinstance(p, dict)
    ][:4]
    out = {
        "type": row.TipoDibujo,
        "sourceTimeframe": row.TemporalidadOrigen,
        "points": compact_points,
    }
    if row.NombreAnalisis:
        out["name"] = row.NombreAnalisis
    if row.Comentario:
        out["comment"] = row.Comentario
    return out


_POSITION_PLAN_TYPES = ("LONG_POSITION", "SHORT_POSITION")


def _summarize_position_plan(row) -> dict | None:
    """Resume una caja de plan de posición (Long/Short) con su riesgo/beneficio.

    Geometría en PuntosJSON (3 puntos: entry/target/stop); datos extra
    (cantidad/fees/notas) en EstiloJSON.position. Cálculos espejo del frontend
    (`positionBoxCalculations.ts`). Devuelve None si la geometría es inválida.
    """
    points = _safe_json(row.PuntosJSON, [])
    if not isinstance(points, list) or len(points) < 3:
        return None
    try:
        entry = float(points[0].get("price"))
        target = float(points[1].get("price"))
        stop = float(points[2].get("price"))
    except (TypeError, ValueError, AttributeError):
        return None

    style = _safe_json(row.EstiloJSON, {})
    pos = style.get("position", {}) if isinstance(style, dict) else {}
    try:
        quantity = float(pos.get("quantity", 1) or 1)
    except (TypeError, ValueError):
        quantity = 1.0
    try:
        fees = float(pos.get("fees", 0) or 0)
    except (TypeError, ValueError):
        fees = 0.0

    is_long = row.TipoDibujo == "LONG_POSITION"
    risk_per_share = (entry - stop) if is_long else (stop - entry)
    reward_per_share = (target - entry) if is_long else (entry - target)
    risk_amount = risk_per_share * quantity + fees
    reward_amount = reward_per_share * quantity - fees
    risk_pct = (risk_per_share / entry * 100) if entry else 0.0
    reward_pct = (reward_per_share / entry * 100) if entry else 0.0
    rr = (reward_per_share / risk_per_share) if risk_per_share > 0 else None

    def _r(v: float | None, n: int = 2) -> float | None:
        return round(v, n) if isinstance(v, (int, float)) else None

    out = {
        "type": row.TipoDibujo,
        "sourceTimeframe": row.TemporalidadOrigen,
        "entryPrice": _r(entry),
        "targetPrice": _r(target),
        "stopPrice": _r(stop),
        "quantity": _r(quantity),
        "fees": _r(fees),
        "riskPerShare": _r(risk_per_share, 4),
        "rewardPerShare": _r(reward_per_share, 4),
        "riskAmount": _r(risk_amount),
        "rewardAmount": _r(reward_amount),
        "riskPercent": _r(risk_pct),
        "rewardPercent": _r(reward_pct),
        "riskRewardRatio": _r(rr),
    }
    notes = pos.get("notes")
    if notes:
        out["notes"] = notes
    if row.Comentario:
        out["comment"] = row.Comentario
    return out


def _position_plans(db: Session, user_id: int, c010_id: int | None) -> list[dict]:
    """Planes de posición (Long/Short) visibles del usuario para el instrumento."""
    if c010_id is None:
        return []
    try:
        rows = DibujosRepository(db).list_by_user_and_action(user_id, c010_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sin planes de posición para contexto: %s", type(exc).__name__)
        return []
    plans: list[dict] = []
    for r in rows:
        if not r.Visible or r.TipoDibujo not in _POSITION_PLAN_TYPES:
            continue
        summary = _summarize_position_plan(r)
        if summary is not None:
            plans.append(summary)
    return plans


def build_stock_context(
    db: Session,
    user_id: int,
    c010_id: int | None,
    symbol: str,
    include_chart_context: bool,
    include_drawings: bool,
    include_indicators: bool,
    include_news: bool,
) -> dict:
    """Contexto estructurado del instrumento para enviar al modelo.

    NUNCA incluye datos sensibles (PasswordHash, emails de otros, tokens).
    """
    user = db.get(Usuario, user_id)
    context: dict = {
        "user": {
            "id": user_id,
            "role": "admin" if (user and user.EsAdmin) else "user",
        },
        "symbol": symbol.upper(),
    }

    # ===== Instrumento (C010) =====
    if c010_id is not None:
        from app.repositories.acciones_repository import AccionesRepository

        accion = AccionesRepository(db).get_by_id(c010_id)
        if accion is not None:
            context["instrument"] = {
                "ticker": accion.Ticker,
                "yahooSymbol": accion.YahooSymbol,
                "name": accion.NombreInstrumento,
                "type": accion.TipoInstrumento,
                "exchange": accion.Exchange,
                "currency": accion.Moneda,
                "country": accion.Pais,
                "sector": accion.Sector,
                "industry": accion.Industria,
                "marketTimezone": accion.TimezoneMercado,
            }

    # ===== Datos de mercado =====
    closes: list[float] = []
    volumes: list[float | None] = []
    if include_chart_context:
        market = _market_summary(symbol)
        closes = market.pop("_closes_1d", [])
        volumes = market.pop("_volumes_1d", [])
        context["market"] = market

    # ===== Indicadores (configs C020 + valores actuales) =====
    if include_indicators:
        configs = []
        try:
            rows = IndicadoresRepository(db).list_by_user_and_action_or_global(user_id)
            for row in rows:
                configs.append(
                    {
                        "id": row.NombreIndicador,
                        "type": row.TipoIndicador,
                        "visible": bool(row.Visible),
                        "params": _safe_json(row.ParametrosJSON, {}),
                    }
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sin configs de indicadores: %s", type(exc).__name__)
        context["indicators"] = {
            "configured": configs,
            "currentDailyValues": _indicator_values(closes, volumes),
            "configuredValues": _configured_indicator_values(configs, closes),
        }

    # ===== Dibujos del usuario (C0101) =====
    if include_drawings and c010_id is not None:
        try:
            rows = DibujosRepository(db).list_by_user_and_action(user_id, c010_id)
            visible = [r for r in rows if r.Visible]
            limit = env_settings.AI_CHAT_MAX_DRAWINGS_CONTEXT
            context["drawings"] = {
                "total": len(visible),
                "items": [_summarize_drawing(r) for r in visible[:limit]],
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sin dibujos para contexto: %s", type(exc).__name__)

        # Planes de posición (cajas Long/Short con riesgo/beneficio).
        plans = _position_plans(db, user_id, c010_id)
        if plans:
            context["positionPlans"] = plans

    # ===== Watchlist/catalogo (C040) =====
    if c010_id is not None:
        try:
            entry = CatalogoRepository(db).get_entry(user_id, c010_id)
            if entry is not None:
                context["watchlist"] = {
                    "favorite": bool(entry.Favorito),
                    "tags": _safe_json(entry.TagsJSON, []),
                    "notes": entry.Notas,
                    "lastViewedAt": entry.UltimaConsulta.isoformat()
                    if entry.UltimaConsulta
                    else None,
                }
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sin catalogo para contexto: %s", type(exc).__name__)

    # ===== Entradas simuladas (paper trading, hipoteticas) =====
    if include_chart_context or include_drawings:
        current_price = (
            context.get("market", {}).get("quote", {}) or {}
        ).get("price")
        entries = _simulated_entries(db, user_id, c010_id, current_price)
        if entries:
            context["simulatedEntries"] = entries

    # ===== Noticias =====
    if include_news:
        items = news_service.get_symbol_news(
            symbol, limit=env_settings.AI_CHAT_MAX_NEWS_ITEMS
        )
        context["news"] = {"news_available": bool(items), "items": items}
        # Contexto global de mercado desde el cache SQL (top 3 + trending 3).
        context["recentGlobalMarketNews"] = _cached_global_headlines(db, limit=3)
        context["topTrendingStocksTodayNews"] = _cached_global_headlines(
            db, limit=3, trending_only=True
        )

    return context


def context_to_text(context: dict) -> str:
    """Serializa el contexto a JSON compacto para el mensaje de sistema."""
    return json.dumps(context, ensure_ascii=False, default=str)


def build_chatgpt_context(db: Session, user_id: int, symbol: str) -> dict:
    """Contexto del ticker para el generador de prompts de ChatGPT (iframe).

    NO llama a OpenAI ni escribe en C110/C111: solo lee datos del usuario
    actual. Misma política de seguridad que build_stock_context.
    """
    from app.repositories.acciones_repository import AccionesRepository
    from app.timeframes import TIMEFRAME_PRESETS

    symbol_up = symbol.strip().upper()
    accion = AccionesRepository(db).get_by_yahoo_symbol(symbol_up)
    c010_id = accion.C010Id if accion is not None else None

    out: dict = {"symbol": symbol_up, "yahooSymbol": symbol_up}

    if accion is not None:
        out["instrument"] = {
            "name": accion.NombreInstrumento,
            "exchange": accion.Exchange,
            "currency": accion.Moneda,
            "sector": accion.Sector,
            "industry": accion.Industria,
        }

    market = _market_summary(symbol_up)
    closes = market.pop("_closes_1d", [])
    volumes = market.pop("_volumes_1d", [])
    out["quote"] = market.get("quote")
    out["asOf"] = market.get("asOf")
    out["dailySummary"] = market.get("daily_1y")
    out["indicatorValues"] = _indicator_values(closes, volumes)
    out["weeklySummary"] = _weekly_summary(symbol_up)

    configs = []
    try:
        rows = IndicadoresRepository(db).list_by_user_and_action_or_global(user_id)
        configs = [
            {
                "id": row.NombreIndicador,
                "type": row.TipoIndicador,
                "visible": bool(row.Visible),
                "params": _safe_json(row.ParametrosJSON, {}),
            }
            for row in rows
        ]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sin configs de indicadores: %s", type(exc).__name__)
    out["indicators"] = configs
    # Valores con los MISMOS parametros que el usuario ve en pantalla.
    out["configuredValues"] = _configured_indicator_values(configs, closes)

    drawings: list[dict] = []
    if c010_id is not None:
        try:
            rows = DibujosRepository(db).list_by_user_and_action(user_id, c010_id)
            limit = env_settings.AI_CHAT_MAX_DRAWINGS_CONTEXT
            drawings = [_summarize_drawing(r) for r in rows if r.Visible][:limit]
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sin dibujos para contexto: %s", type(exc).__name__)
    out["drawings"] = drawings
    # Planes de posición (cajas Long/Short con riesgo/beneficio).
    out["positionPlans"] = _position_plans(db, user_id, c010_id)

    watchlist = None
    if c010_id is not None:
        try:
            entry = CatalogoRepository(db).get_entry(user_id, c010_id)
            if entry is not None and entry.Activo:
                watchlist = {
                    "favorite": bool(entry.Favorito),
                    "tags": _safe_json(entry.TagsJSON, []),
                    "notes": entry.Notas,
                    "lastViewed": entry.UltimaConsulta.isoformat()
                    if entry.UltimaConsulta
                    else None,
                }
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sin catalogo para contexto: %s", type(exc).__name__)
    out["watchlist"] = watchlist

    quote_price = (out.get("quote") or {}).get("price")
    out["simulatedEntries"] = _simulated_entries(db, user_id, c010_id, quote_price)

    # Titulares recientes del ticker (best-effort; [] si no hay fuente).
    try:
        headlines = news_service.get_symbol_news(symbol_up, limit=5)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sin noticias para contexto: %s", type(exc).__name__)
        headlines = []
    out["recentNews"] = [
        {
            "title": n.get("title"),
            "publisher": n.get("publisher"),
            "publishedAt": n.get("publishedAt"),
            "url": n.get("url"),
        }
        for n in headlines[:5]
    ]
    out["recentGlobalMarketNews"] = _cached_global_headlines(db, limit=3)
    out["topTrendingStocksTodayNews"] = _cached_global_headlines(
        db, limit=3, trending_only=True
    )

    out["timeframes"] = [
        {"key": p.key, "label": p.label, "interval": p.interval}
        for p in TIMEFRAME_PRESETS
    ]
    return out
