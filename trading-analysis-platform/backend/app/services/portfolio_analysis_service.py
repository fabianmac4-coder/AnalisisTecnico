"""Cálculos y análisis de portafolio (Fase 4).

Toma las posiciones (C091) de un portafolio, consulta la cotización canónica de
Yahoo (best-effort) y arma: resumen de valor/ganancia, asignación (por posición/
sector/industria/tipo/moneda), riesgo de concentración, comparación vs S&P 500 y
recomendaciones basadas en REGLAS (sin asesoría directa). Las métricas avanzadas
(beta/volatilidad/sharpe/drawdown) son null hasta tener histórico suficiente:
NUNCA se inventan. Nada de esto lanza: los fallos devuelven warnings.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Portafolio
from app.repositories.portfolio_repository import PortfolioRepository
from app.services import yahoo_service

BENCHMARK_SYMBOL = "^GSPC"
BENCHMARK_NAME = "S&P 500"
_ADVANCED_NOTE = (
    "Las métricas de riesgo avanzadas (beta, volatilidad, Sharpe, drawdown) "
    "requieren histórico de precios y aún no están disponibles."
)


def _f(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _round(value, n=2):
    return round(value, n) if value is not None else None


def _quote_price(symbol: str, cache: dict) -> float | None:
    if not symbol:
        return None
    if symbol in cache:
        return cache[symbol]
    price = None
    try:
        q = yahoo_service.get_quote(symbol)
        price = q.price if q and q.price is not None else None
    except Exception:  # noqa: BLE001
        price = None
    cache[symbol] = price
    return price


def _allocation(rows: list[dict], key: str) -> list[dict]:
    """Agrega currentValue por `key` (sector/industry/etc.) -> [{label, value, weight}]."""
    totals: dict[str, float] = {}
    grand = 0.0
    for r in rows:
        cv = r.get("currentValue")
        if cv is None:
            continue
        label = r.get(key) or "Desconocido"
        totals[label] = totals.get(label, 0.0) + cv
        grand += cv
    out = [
        {"label": k, "value": _round(v), "weight": _round(v / grand * 100) if grand else 0}
        for k, v in totals.items()
    ]
    out.sort(key=lambda x: x["value"] or 0, reverse=True)
    return out


def _benchmark(positions: list, portfolio_return: float | None) -> dict:
    dates = [p.FechaCompra for p in positions if p.FechaCompra is not None]
    if not dates or portfolio_return is None:
        return {
            "available": False,
            "benchmarkSymbol": BENCHMARK_SYMBOL,
            "benchmarkName": BENCHMARK_NAME,
            "message": "Comparación con el índice no disponible (faltan fechas de compra).",
        }
    earliest = min(dates)
    earliest_ms = int(earliest.replace(tzinfo=timezone.utc).timestamp() * 1000)
    days = (datetime.now(timezone.utc) - earliest.replace(tzinfo=timezone.utc)).days
    preset = (
        "1W_30M" if days <= 7 else
        "1M_1H" if days <= 30 else
        "3M_1D" if days <= 90 else
        "6M_1D" if days <= 180 else
        "1Y_1D" if days <= 365 else
        "4Y_1W"
    )
    try:
        resp = yahoo_service.get_ohlcv(BENCHMARK_SYMBOL, preset)
        bars = [b for b in resp.bars if b.time >= earliest_ms]
        if len(bars) < 2:
            bars = resp.bars
        if len(bars) < 2:
            raise ValueError("sin barras suficientes")
        start = bars[0].close
        end = bars[-1].close
        bench_return = (end / start - 1) * 100 if start else None
    except Exception:  # noqa: BLE001
        return {
            "available": False,
            "benchmarkSymbol": BENCHMARK_SYMBOL,
            "benchmarkName": BENCHMARK_NAME,
            "message": "Comparación con el índice no disponible ahora mismo.",
        }
    return {
        "available": True,
        "benchmarkSymbol": BENCHMARK_SYMBOL,
        "benchmarkName": BENCHMARK_NAME,
        "portfolioReturn": _round(portfolio_return),
        "benchmarkReturn": _round(bench_return),
        "alphaEstimate": _round(portfolio_return - bench_return) if bench_return is not None else None,
        "period": "desde la fecha de compra más antigua (aproximación)",
        "note": "La comparación usa la fecha de compra más antigua del portafolio como aproximación.",
    }


def _recommendations(rows: list[dict], by_sector: list[dict], position_count: int) -> list[dict]:
    recs: list[dict] = []
    for r in rows:
        w = r.get("portfolioWeight")
        if w is not None and w > 35:
            recs.append({"type": "CONCENTRATION", "severity": "HIGH",
                         "message": f"{r['ticker']} representa el {w:.1f}% del portafolio. "
                                    "Confirma si esta concentración es intencional."})
        elif w is not None and w > 20:
            recs.append({"type": "CONCENTRATION", "severity": "MEDIUM",
                         "message": f"{r['ticker']} representa el {w:.1f}% del portafolio. "
                                    "Confirma si esta concentración es intencional."})
        glp = r.get("gainLossPercent")
        if glp is not None and glp < -20:
            recs.append({"type": "LOSER", "severity": "MEDIUM",
                         "message": f"{r['ticker']} cae más de 20%. Revisa la tesis y los "
                                    "límites de riesgo."})
        if glp is not None and glp > 50 and (w or 0) > 15:
            recs.append({"type": "WINNER", "severity": "LOW",
                         "message": f"{r['ticker']} se ha revalorizado mucho y ahora pesa "
                                    f"{w:.1f}% del portafolio; monitorea la asignación."})
    top3 = sum((a["weight"] or 0) for a in sorted(
        [{"weight": r.get("portfolioWeight")} for r in rows],
        key=lambda x: x["weight"] or 0, reverse=True)[:3])
    if top3 > 60:
        recs.append({"type": "CONCENTRATION", "severity": "MEDIUM",
                     "message": f"Las 3 mayores posiciones suman {top3:.1f}% del portafolio; "
                                "revisa la concentración."})
    for s in by_sector:
        if s["label"] == "Desconocido":
            continue
        w = s["weight"] or 0
        if w > 60:
            recs.append({"type": "SECTOR", "severity": "HIGH",
                         "message": f"El sector {s['label']} representa {w:.1f}% del portafolio; "
                                    "es muy sensible a eventos del sector."})
        elif w > 40:
            recs.append({"type": "SECTOR", "severity": "MEDIUM",
                         "message": f"El sector {s['label']} representa {w:.1f}% del portafolio; "
                                    "el portafolio puede ser sensible a eventos del sector."})
    if 0 < position_count < 5:
        recs.append({"type": "DIVERSIFICATION", "severity": "LOW",
                     "message": "El portafolio tiene pocas posiciones; la diversificación "
                                "puede ser limitada."})
    if any((r.get("currency") or "USD").upper() != "USD" for r in rows):
        recs.append({"type": "CURRENCY", "severity": "LOW",
                     "message": "El portafolio tiene exposición a monedas distintas del USD; "
                                "los movimientos de tipo de cambio pueden afectar los retornos."})
    return recs


def _risk_level(position_count: int, largest_w: float, top3_w: float, sector_w: float) -> str:
    if position_count == 0:
        return "UNKNOWN"
    if largest_w > 35 or sector_w > 60:
        return "HIGH_CONCENTRATION"
    if position_count < 3 or top3_w > 70:
        return "AGGRESSIVE"
    if position_count >= 8 and largest_w < 20:
        return "CONSERVATIVE"
    return "MODERATE"


def build_analysis(db: Session, user_id: int, portfolio: Portafolio) -> dict:
    repo = PortfolioRepository(db)
    positions = repo.list_positions(user_id, portfolio.C090Id)
    warnings: list[str] = []
    price_cache: dict = {}

    rows: list[dict] = []
    total_cost = 0.0
    total_value = 0.0
    any_price = False
    for p in positions:
        qty = _f(p.Cantidad)
        avg = _f(p.PrecioCompraPromedio)
        cost_basis = qty * avg
        total_cost += cost_basis
        symbol = p.YahooSymbol or p.Ticker
        price = _quote_price(symbol, price_cache)
        data_warnings: list[str] = []
        if price is None:
            data_warnings.append("Precio actual no disponible para esta posición.")
        else:
            any_price = True
            total_value += qty * price
        current_value = qty * price if price is not None else None
        gain_loss = (current_value - cost_basis) if current_value is not None else None
        gl_pct = (gain_loss / cost_basis * 100) if (gain_loss is not None and cost_basis) else None
        rows.append({
            "c091Id": p.C091Id, "ticker": p.Ticker, "companyName": p.NombreInstrumento,
            "quantity": qty, "averageCost": avg, "currentPrice": _round(price, 4),
            "costBasis": _round(cost_basis), "currentValue": _round(current_value),
            "gainLoss": _round(gain_loss), "gainLossPercent": _round(gl_pct),
            "portfolioWeight": None, "sector": p.Sector, "industry": p.Industria,
            "assetType": p.TipoInstrumento, "currency": p.Moneda or "USD",
            "dataWarnings": data_warnings,
        })

    # Pesos (sobre el valor actual total).
    for r in rows:
        if r["currentValue"] is not None and total_value:
            r["portfolioWeight"] = _round(r["currentValue"] / total_value * 100)

    total_gain_loss = (total_value - total_cost) if any_price else None
    total_gl_pct = (total_gain_loss / total_cost * 100) if (total_gain_loss is not None and total_cost) else None

    valued = [r for r in rows if r["gainLossPercent"] is not None]
    best = max(valued, key=lambda r: r["gainLossPercent"], default=None)
    worst = min(valued, key=lambda r: r["gainLossPercent"], default=None)

    by_sector = _allocation(rows, "sector")
    by_position = sorted(
        [{"label": r["ticker"], "value": r["currentValue"], "weight": r["portfolioWeight"]}
         for r in rows if r["currentValue"] is not None],
        key=lambda x: x["value"] or 0, reverse=True)

    largest_w = max((r["portfolioWeight"] or 0 for r in rows), default=0)
    largest_ticker = next((r["ticker"] for r in rows
                           if (r["portfolioWeight"] or 0) == largest_w and largest_w), None)
    top3_w = sum(sorted((r["portfolioWeight"] or 0 for r in rows), reverse=True)[:3])
    largest_sector = by_sector[0] if by_sector else None
    largest_sector_w = largest_sector["weight"] if largest_sector else 0

    if positions and not any_price:
        warnings.append("No se pudo obtener el precio actual de ninguna posición.")

    return {
        "portfolio": {
            "c090Id": portfolio.C090Id, "name": portfolio.NombrePortafolio,
            "baseCurrency": portfolio.MonedaBase,
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
        },
        "summary": {
            "totalCost": _round(total_cost), "currentValue": _round(total_value) if any_price else None,
            "totalGainLoss": _round(total_gain_loss),
            "totalGainLossPercent": _round(total_gl_pct),
            "positionCount": len(positions),
            "bestPosition": best, "worstPosition": worst, "cashValue": None,
        },
        "positions": rows,
        "allocation": {
            "byPosition": by_position,
            "bySector": by_sector,
            "byIndustry": _allocation(rows, "industry"),
            "byAssetType": _allocation(rows, "assetType"),
            "byCurrency": _allocation(rows, "currency"),
        },
        "risk": {
            "concentrationRisk": {
                "largestPositionTicker": largest_ticker,
                "largestPositionWeight": _round(largest_w),
                "top3Weight": _round(top3_w),
                "flagged": largest_w > 20 or top3_w > 60,
            },
            "sectorRisk": {
                "largestSector": largest_sector["label"] if largest_sector else None,
                "largestSectorWeight": _round(largest_sector_w),
                "flagged": largest_sector_w > 40,
            },
            "estimatedVolatility": None, "estimatedBeta": None,
            "sharpeRatio": None, "maxDrawdown": None,
            "correlationWarnings": [],
            "advancedMetricsAvailable": False, "advancedMetricsNote": _ADVANCED_NOTE,
            "riskLevel": _risk_level(len(positions), largest_w, top3_w, largest_sector_w),
        },
        "benchmark": _benchmark(positions, total_gl_pct),
        "recommendations": _recommendations(rows, by_sector, len(positions)),
        "aiSummary": None,
        "warnings": warnings,
    }
