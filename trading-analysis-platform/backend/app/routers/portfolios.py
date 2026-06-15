"""Router de Portfolio Analysis (Fase 4). C090 portafolios + C091 posiciones.

Todos los endpoints requieren usuario autenticado activo y se acotan por C005Id.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.repositories.acciones_repository import AccionesRepository, normalize_ticker
from app.repositories.portfolio_repository import PortfolioRepository
from app.security.dependencies import get_current_active_user
from app.services import portfolio_analysis_service, yahoo_service
from app.services.openai_service import AIServiceError
from app.services import openai_service

router = APIRouter(prefix="/portfolios", tags=["Portfolios"])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------
class PortfolioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    baseCurrency: str = Field(default="USD", max_length=10)


class PortfolioUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    baseCurrency: str | None = Field(default=None, max_length=10)


class PortfolioOut(BaseModel):
    c090Id: int
    name: str
    description: str | None
    baseCurrency: str
    isDefault: bool
    active: bool
    createdAt: datetime
    updatedAt: datetime


class PositionCreate(BaseModel):
    ticker: str = Field(min_length=1, max_length=30)
    quantity: float
    averageCost: float
    purchaseDate: datetime | None = None
    notes: str | None = Field(default=None, max_length=1000)
    assetType: str | None = Field(default=None, max_length=50)
    sector: str | None = Field(default=None, max_length=150)
    industry: str | None = Field(default=None, max_length=150)


class PositionUpdate(BaseModel):
    quantity: float | None = None
    averageCost: float | None = None
    purchaseDate: datetime | None = None
    notes: str | None = Field(default=None, max_length=1000)
    assetType: str | None = Field(default=None, max_length=50)
    sector: str | None = Field(default=None, max_length=150)
    industry: str | None = Field(default=None, max_length=150)


class PositionOut(BaseModel):
    c091Id: int
    c090Id: int
    c010Id: int | None
    ticker: str
    yahooSymbol: str | None
    companyName: str | None
    assetType: str
    quantity: float
    averageCost: float
    purchaseDate: datetime | None
    currency: str | None
    sector: str | None
    industry: str | None
    notes: str | None


def _portfolio_out(row) -> PortfolioOut:
    return PortfolioOut(
        c090Id=row.C090Id, name=row.NombrePortafolio, description=row.Descripcion,
        baseCurrency=row.MonedaBase, isDefault=row.EsDefault, active=row.Activo,
        createdAt=row.FechaCreacion, updatedAt=row.FechaActualizacion,
    )


def _position_out(row) -> PositionOut:
    return PositionOut(
        c091Id=row.C091Id, c090Id=row.C090Id, c010Id=row.C010Id, ticker=row.Ticker,
        yahooSymbol=row.YahooSymbol, companyName=row.NombreInstrumento,
        assetType=row.TipoInstrumento, quantity=float(row.Cantidad),
        averageCost=float(row.PrecioCompraPromedio), purchaseDate=row.FechaCompra,
        currency=row.Moneda, sector=row.Sector, industry=row.Industria, notes=row.Notas,
    )


# --------------------------------------------------------------------------
# Portafolios
# --------------------------------------------------------------------------
@router.get("", response_model=list[PortfolioOut])
def list_portfolios(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[PortfolioOut]:
    repo = PortfolioRepository(db)
    return [_portfolio_out(p) for p in repo.list_portfolios_for_user(user.C005Id)]


@router.post("", response_model=PortfolioOut, status_code=201)
def create_portfolio(
    payload: PortfolioCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> PortfolioOut:
    repo = PortfolioRepository(db)
    row = repo.create_portfolio(
        user.C005Id, payload.name, payload.description, payload.baseCurrency
    )
    db.commit()
    return _portfolio_out(row)


@router.patch("/{c090_id}", response_model=PortfolioOut)
def update_portfolio(
    c090_id: int,
    payload: PortfolioUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> PortfolioOut:
    repo = PortfolioRepository(db)
    row = repo.update_portfolio(user.C005Id, c090_id, payload.model_dump(exclude_unset=True))
    if row is None:
        raise HTTPException(status_code=404, detail="Portafolio no encontrado")
    db.commit()
    return _portfolio_out(row)


@router.delete("/{c090_id}", status_code=204)
def delete_portfolio(
    c090_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    repo = PortfolioRepository(db)
    if not repo.soft_delete_portfolio(user.C005Id, c090_id):
        raise HTTPException(status_code=404, detail="Portafolio no encontrado")
    db.commit()


@router.patch("/{c090_id}/set-default", response_model=PortfolioOut)
def set_default_portfolio(
    c090_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> PortfolioOut:
    repo = PortfolioRepository(db)
    row = repo.set_default_portfolio(user.C005Id, c090_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Portafolio no encontrado")
    db.commit()
    return _portfolio_out(row)


# --------------------------------------------------------------------------
# Posiciones
# --------------------------------------------------------------------------
@router.get("/{c090_id}/positions", response_model=list[PositionOut])
def list_positions(
    c090_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[PositionOut]:
    repo = PortfolioRepository(db)
    if repo.get_portfolio_for_user(user.C005Id, c090_id) is None:
        raise HTTPException(status_code=404, detail="Portafolio no encontrado")
    return [_position_out(p) for p in repo.list_positions(user.C005Id, c090_id)]


@router.post("/{c090_id}/positions", response_model=PositionOut, status_code=201)
def add_position(
    c090_id: int,
    payload: PositionCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> PositionOut:
    if payload.quantity <= 0:
        raise HTTPException(status_code=422, detail="La cantidad debe ser mayor que 0.")
    if payload.averageCost < 0:
        raise HTTPException(status_code=422, detail="El costo promedio no puede ser negativo.")

    repo = PortfolioRepository(db)
    if repo.get_portfolio_for_user(user.C005Id, c090_id) is None:
        raise HTTPException(status_code=404, detail="Portafolio no encontrado")

    ticker = normalize_ticker(payload.ticker)
    data = {
        "ticker": ticker, "quantity": payload.quantity, "averageCost": payload.averageCost,
        "purchaseDate": payload.purchaseDate, "notes": payload.notes,
        "assetType": payload.assetType, "sector": payload.sector, "industry": payload.industry,
        "yahooSymbol": ticker, "currency": None, "companyName": None,
    }
    # Enriquecimiento best-effort vía Yahoo (jamás rompe el alta).
    try:
        quote = yahoo_service.get_quote(ticker)
        if quote and quote.currency:
            data["currency"] = quote.currency
    except Exception:  # noqa: BLE001
        pass
    try:
        fund = yahoo_service.get_fundamentals(ticker)
        data["companyName"] = fund.get("longName") or fund.get("shortName")
        if not payload.sector:
            data["sector"] = fund.get("sector")
        if not payload.industry:
            data["industry"] = fund.get("industry")
    except Exception:  # noqa: BLE001
        pass
    try:
        accion = AccionesRepository(db).get_or_create_from_yahoo_symbol(
            ticker, {"name": data.get("companyName"), "currency": data.get("currency")}
        )
        data["c010Id"] = accion.C010Id
        if not data.get("companyName"):
            data["companyName"] = accion.NombreInstrumento
    except Exception:  # noqa: BLE001
        data["c010Id"] = None

    row = repo.add_position(user.C005Id, c090_id, data)
    db.commit()
    return _position_out(row)


@router.patch("/positions/{c091_id}", response_model=PositionOut)
def update_position(
    c091_id: int,
    payload: PositionUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> PositionOut:
    if payload.quantity is not None and payload.quantity <= 0:
        raise HTTPException(status_code=422, detail="La cantidad debe ser mayor que 0.")
    if payload.averageCost is not None and payload.averageCost < 0:
        raise HTTPException(status_code=422, detail="El costo promedio no puede ser negativo.")
    repo = PortfolioRepository(db)
    row = repo.update_position(user.C005Id, c091_id, payload.model_dump(exclude_unset=True))
    if row is None:
        raise HTTPException(status_code=404, detail="Posición no encontrada")
    db.commit()
    return _position_out(row)


@router.delete("/positions/{c091_id}", status_code=204)
def delete_position(
    c091_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    repo = PortfolioRepository(db)
    if not repo.soft_delete_position(user.C005Id, c091_id):
        raise HTTPException(status_code=404, detail="Posición no encontrada")
    db.commit()


# --------------------------------------------------------------------------
# Análisis + resumen de IA
# --------------------------------------------------------------------------
@router.get("/{c090_id}/analysis")
def portfolio_analysis(
    c090_id: int,
    forceRefresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    repo = PortfolioRepository(db)
    portfolio = repo.get_portfolio_for_user(user.C005Id, c090_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portafolio no encontrado")
    return portfolio_analysis_service.build_analysis(db, user.C005Id, portfolio)


def _ai_context(analysis: dict) -> str:
    s = analysis.get("summary", {})
    lines = [
        f"Portafolio: {analysis['portfolio'].get('name')} ({analysis['portfolio'].get('baseCurrency')})",
        f"Costo total: {s.get('totalCost')} · Valor actual: {s.get('currentValue')} · "
        f"P/L: {s.get('totalGainLoss')} ({s.get('totalGainLossPercent')}%) · "
        f"Posiciones: {s.get('positionCount')}",
    ]
    risk = analysis.get("risk", {})
    cr = risk.get("concentrationRisk", {})
    lines.append(
        f"Riesgo: nivel {risk.get('riskLevel')} · mayor posición "
        f"{cr.get('largestPositionTicker')} {cr.get('largestPositionWeight')}% · "
        f"top3 {cr.get('top3Weight')}%"
    )
    top = sorted(analysis.get("positions", []),
                 key=lambda r: (r.get("portfolioWeight") or 0), reverse=True)[:8]
    for r in top:
        lines.append(
            f"- {r['ticker']}: peso {r.get('portfolioWeight')}% · "
            f"P/L {r.get('gainLossPercent')}% · sector {r.get('sector')}"
        )
    for rec in analysis.get("recommendations", [])[:6]:
        lines.append(f"Recomendación [{rec['severity']}]: {rec['message']}")
    return "\n".join(lines)


@router.post("/{c090_id}/ai-summary")
def portfolio_ai_summary(
    c090_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    repo = PortfolioRepository(db)
    portfolio = repo.get_portfolio_for_user(user.C005Id, c090_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portafolio no encontrado")
    if not openai_service.is_configured():
        return {"available": False, "summary": None,
                "message": "Resumen de IA no disponible (IA no configurada)."}
    analysis = portfolio_analysis_service.build_analysis(db, user.C005Id, portfolio)
    user_message = (
        "Resume en español la salud de este portafolio: concentración, "
        "diversificación, posiciones que más pesan o más pierden, y 3-5 puntos a "
        "vigilar. Usa lenguaje de escenarios, NUNCA des asesoría de compra/venta "
        "garantizada."
    )
    try:
        content, _ti, _to = openai_service.generate_reply(_ai_context(analysis), [], user_message)
    except AIServiceError as exc:
        return {"available": False, "summary": None, "message": str(exc)}
    return {"available": True, "summary": content}
