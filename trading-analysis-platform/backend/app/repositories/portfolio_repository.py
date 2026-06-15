"""Repositorio SQL de portafolios (dbo.C090) y posiciones (dbo.C091).

TODAS las consultas se acotan por C005Id: un usuario nunca ve ni toca los
portafolios/posiciones de otro. Borrado suave via Activo. Tablas IDENTITY (no
usan next_id). No hace commit: el caller decide la transacción.
"""
from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import Portafolio, PosicionPortafolio
from app.repositories.sql_utils import utcnow


class PortfolioRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---- Portafolios (C090) ----
    def list_portfolios_for_user(self, user_id: int) -> list[Portafolio]:
        return list(
            self.db.execute(
                select(Portafolio)
                .where(
                    Portafolio.C005Id == user_id,
                    Portafolio.Activo == True,  # noqa: E712
                )
                .order_by(Portafolio.EsDefault.desc(), Portafolio.C090Id.asc())
            ).scalars()
        )

    def get_portfolio_for_user(self, user_id: int, c090_id: int) -> Portafolio | None:
        return self.db.execute(
            select(Portafolio).where(
                Portafolio.C090Id == c090_id,
                Portafolio.C005Id == user_id,
                Portafolio.Activo == True,  # noqa: E712
            )
        ).scalar_one_or_none()

    def create_portfolio(
        self, user_id: int, name: str, description: str | None, base_currency: str
    ) -> Portafolio:
        now = utcnow()
        is_first = len(self.list_portfolios_for_user(user_id)) == 0
        row = Portafolio(
            C005Id=user_id,
            NombrePortafolio=name.strip(),
            Descripcion=(description or None),
            MonedaBase=(base_currency or "USD").upper()[:10],
            EsDefault=is_first,
            Activo=True,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_portfolio(
        self, user_id: int, c090_id: int, changes: dict
    ) -> Portafolio | None:
        row = self.get_portfolio_for_user(user_id, c090_id)
        if row is None:
            return None
        if "name" in changes and changes["name"]:
            row.NombrePortafolio = changes["name"].strip()
        if "description" in changes:
            row.Descripcion = changes["description"] or None
        if "baseCurrency" in changes and changes["baseCurrency"]:
            row.MonedaBase = changes["baseCurrency"].upper()[:10]
        row.FechaActualizacion = utcnow()
        self.db.flush()
        return row

    def soft_delete_portfolio(self, user_id: int, c090_id: int) -> bool:
        row = self.get_portfolio_for_user(user_id, c090_id)
        if row is None:
            return False
        row.Activo = False
        row.FechaActualizacion = utcnow()
        # Las posiciones del portafolio también se desactivan.
        self.db.execute(
            update(PosicionPortafolio)
            .where(
                PosicionPortafolio.C090Id == c090_id,
                PosicionPortafolio.C005Id == user_id,
            )
            .values(Activo=False, FechaActualizacion=utcnow())
        )
        self.db.flush()
        return True

    def set_default_portfolio(self, user_id: int, c090_id: int) -> Portafolio | None:
        row = self.get_portfolio_for_user(user_id, c090_id)
        if row is None:
            return None
        # Quita EsDefault de los demás portafolios del usuario.
        self.db.execute(
            update(Portafolio)
            .where(Portafolio.C005Id == user_id, Portafolio.C090Id != c090_id)
            .values(EsDefault=False)
        )
        row.EsDefault = True
        row.FechaActualizacion = utcnow()
        self.db.flush()
        return row

    # ---- Posiciones (C091) ----
    def list_positions(self, user_id: int, c090_id: int) -> list[PosicionPortafolio]:
        return list(
            self.db.execute(
                select(PosicionPortafolio)
                .where(
                    PosicionPortafolio.C090Id == c090_id,
                    PosicionPortafolio.C005Id == user_id,
                    PosicionPortafolio.Activo == True,  # noqa: E712
                )
                .order_by(PosicionPortafolio.C091Id.asc())
            ).scalars()
        )

    def get_position_for_user(
        self, user_id: int, c091_id: int
    ) -> PosicionPortafolio | None:
        return self.db.execute(
            select(PosicionPortafolio).where(
                PosicionPortafolio.C091Id == c091_id,
                PosicionPortafolio.C005Id == user_id,
                PosicionPortafolio.Activo == True,  # noqa: E712
            )
        ).scalar_one_or_none()

    def add_position(
        self, user_id: int, c090_id: int, data: dict
    ) -> PosicionPortafolio:
        now = utcnow()
        row = PosicionPortafolio(
            C090Id=c090_id,
            C005Id=user_id,
            C010Id=data.get("c010Id"),
            Ticker=data["ticker"],
            YahooSymbol=data.get("yahooSymbol"),
            NombreInstrumento=data.get("companyName"),
            TipoInstrumento=data.get("assetType") or "STOCK",
            Cantidad=data["quantity"],
            PrecioCompraPromedio=data["averageCost"],
            FechaCompra=data.get("purchaseDate"),
            Moneda=data.get("currency"),
            Sector=data.get("sector"),
            Industria=data.get("industry"),
            Notas=(data.get("notes") or None),
            Activo=True,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_position(
        self, user_id: int, c091_id: int, changes: dict
    ) -> PosicionPortafolio | None:
        row = self.get_position_for_user(user_id, c091_id)
        if row is None:
            return None
        if "quantity" in changes and changes["quantity"] is not None:
            row.Cantidad = changes["quantity"]
        if "averageCost" in changes and changes["averageCost"] is not None:
            row.PrecioCompraPromedio = changes["averageCost"]
        if "purchaseDate" in changes:
            row.FechaCompra = changes["purchaseDate"]
        if "notes" in changes:
            row.Notas = changes["notes"] or None
        if "sector" in changes and changes["sector"]:
            row.Sector = changes["sector"]
        if "industry" in changes and changes["industry"]:
            row.Industria = changes["industry"]
        if "assetType" in changes and changes["assetType"]:
            row.TipoInstrumento = changes["assetType"]
        row.FechaActualizacion = utcnow()
        self.db.flush()
        return row

    def soft_delete_position(self, user_id: int, c091_id: int) -> bool:
        row = self.get_position_for_user(user_id, c091_id)
        if row is None:
            return False
        row.Activo = False
        row.FechaActualizacion = utcnow()
        self.db.flush()
        return True
