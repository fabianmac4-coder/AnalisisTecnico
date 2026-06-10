"""Repositorio SQL de instrumentos (dbo.C010)."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Accion
from app.repositories.sql_utils import next_id, utcnow


def normalize_ticker(ticker: str) -> str:
    """Igual que la columna calculada TickerNormalizado: UPPER(TRIM(...))."""
    return ticker.strip().upper()


class AccionesRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, c010_id: int) -> Accion | None:
        return self.db.get(Accion, c010_id)

    def get_by_ticker(self, ticker: str, fuente: str = "yahoo") -> Accion | None:
        normalized = normalize_ticker(ticker)
        return self.db.execute(
            select(Accion).where(
                func.upper(func.trim(Accion.Ticker)) == normalized,
                Accion.FuenteDatos == fuente,
            )
        ).scalar_one_or_none()

    def get_by_yahoo_symbol(self, symbol: str) -> Accion | None:
        return self.db.execute(
            select(Accion).where(
                func.upper(Accion.YahooSymbol) == normalize_ticker(symbol)
            )
        ).scalar_one_or_none()

    def get_or_create_from_yahoo_symbol(
        self, symbol: str, meta: dict | None = None
    ) -> Accion:
        """Resuelve un simbolo de Yahoo a C010, creandolo si no existe.

        `meta` (opcional) viene de yfinance: name/exchange/currency/type/timezone.
        El repositorio NO hace red: el caller decide si enriquecer.
        """
        symbol_up = normalize_ticker(symbol)
        existing = self.get_by_yahoo_symbol(symbol_up) or self.get_by_ticker(symbol_up)
        if existing is not None:
            return existing

        meta = meta or {}
        now = utcnow()
        accion = Accion(
            C010Id=next_id(self.db, Accion.C010Id),
            Ticker=symbol_up,
            NombreInstrumento=meta.get("name"),
            TipoInstrumento=meta.get("type") or "unknown",
            Exchange=meta.get("exchange"),
            Moneda=meta.get("currency"),
            TimezoneMercado=meta.get("timezone"),
            FuenteDatos="yahoo",
            YahooSymbol=symbol_up,
            Activo=True,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(accion)
        self.db.flush()
        return accion

    def upsert_action(self, symbol: str, meta: dict) -> Accion:
        """Crea o actualiza metadata del instrumento (sync desde Yahoo)."""
        accion = self.get_or_create_from_yahoo_symbol(symbol, meta)
        if meta.get("name"):
            accion.NombreInstrumento = meta["name"]
        if meta.get("exchange"):
            accion.Exchange = meta["exchange"]
        if meta.get("currency"):
            accion.Moneda = meta["currency"]
        if meta.get("type"):
            accion.TipoInstrumento = meta["type"]
        if meta.get("timezone"):
            accion.TimezoneMercado = meta["timezone"]
        accion.FechaActualizacion = utcnow()
        self.db.flush()
        return accion

    def search(self, query: str, limit: int = 20) -> list[Accion]:
        q = f"%{normalize_ticker(query)}%"
        return list(
            self.db.execute(
                select(Accion)
                .where(
                    Accion.Activo == True,  # noqa: E712
                    func.upper(Accion.Ticker).like(q),
                )
                .order_by(Accion.Ticker)
                .limit(limit)
            ).scalars()
        )
