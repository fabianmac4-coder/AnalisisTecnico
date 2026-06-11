"""Repositorio SQL de entradas simuladas / paper trading (dbo.C050).

SIEMPRE acotado por C005Id. Borrado suave (Activo=0); jamas toca C010,
dibujos ni indicadores. NO es trading real: seguimiento hipotetico.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import OperacionSimulada
from app.repositories.sql_utils import utcnow

ESTADO_ABIERTA = "ABIERTA"
ESTADO_CERRADA = "CERRADA"


class OperacionesSimuladasRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user_and_action(
        self, user_id: int, c010_id: int
    ) -> list[OperacionSimulada]:
        return list(
            self.db.execute(
                select(OperacionSimulada)
                .where(
                    OperacionSimulada.C005Id == user_id,
                    OperacionSimulada.C010Id == c010_id,
                    OperacionSimulada.Activo == True,  # noqa: E712
                )
                .order_by(OperacionSimulada.FechaEntrada.desc())
            ).scalars()
        )

    def get_by_id_for_user(
        self, user_id: int, c050_id: int
    ) -> OperacionSimulada | None:
        """Solo devuelve la operacion si pertenece al usuario (aislamiento)."""
        op = self.db.get(OperacionSimulada, c050_id)
        if op is None or op.C005Id != user_id or not op.Activo:
            return None
        return op

    def create_entry(
        self,
        user_id: int,
        c010_id: int,
        tipo: str,
        precio_entrada: float,
        fecha_entrada: datetime,
        cantidad: float | None = None,
        temporalidad: str | None = None,
        nombre: str | None = None,
        notas: str | None = None,
        color: str | None = None,
    ) -> OperacionSimulada:
        now = utcnow()
        op = OperacionSimulada(
            C005Id=user_id,
            C010Id=c010_id,
            TipoOperacion=tipo,
            PrecioEntrada=precio_entrada,
            Cantidad=cantidad,
            FechaEntrada=fecha_entrada,
            TemporalidadOrigen=temporalidad,
            NombreOperacion=nombre,
            Notas=notas,
            Estado=ESTADO_ABIERTA,
            Color=color,
            Visible=True,
            Activo=True,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(op)
        self.db.flush()
        return op

    def update_entry(
        self, user_id: int, c050_id: int, **changes
    ) -> OperacionSimulada | None:
        op = self.get_by_id_for_user(user_id, c050_id)
        if op is None:
            return None
        for key, value in changes.items():
            setattr(op, key, value)
        op.FechaActualizacion = utcnow()
        self.db.flush()
        return op

    def close_entry(
        self,
        user_id: int,
        c050_id: int,
        exit_price: float,
        exit_date: datetime,
        reason: str | None = None,
    ) -> OperacionSimulada | None:
        op = self.get_by_id_for_user(user_id, c050_id)
        if op is None:
            return None
        op.Estado = ESTADO_CERRADA
        op.PrecioSalida = exit_price
        op.FechaSalida = exit_date
        op.MotivoSalida = reason
        op.FechaActualizacion = utcnow()
        self.db.flush()
        return op

    def soft_delete_entry(self, user_id: int, c050_id: int) -> bool:
        op = self.get_by_id_for_user(user_id, c050_id)
        if op is None:
            return False
        op.Activo = False
        op.Visible = False
        op.FechaActualizacion = utcnow()
        self.db.flush()
        return True


def calculate_performance(
    op: OperacionSimulada, current_price: float | None
) -> dict:
    """Rendimiento hipotetico. CERRADA usa PrecioSalida; ABIERTA el precio actual.

    LONG:  ganancia = precio_ref - entrada
    SHORT: ganancia = entrada - precio_ref
    """
    entry = float(op.PrecioEntrada)
    if op.Estado == ESTADO_CERRADA and op.PrecioSalida is not None:
        reference: float | None = float(op.PrecioSalida)
    else:
        reference = current_price

    out: dict = {
        "currentPrice": reference,
        "gainLossAmount": None,
        "gainLossPercent": None,
        "totalGainLossAmount": None,
        "daysSinceEntry": max((utcnow() - op.FechaEntrada).days, 0),
    }
    if reference is None or entry == 0:
        return out

    if op.TipoOperacion == "SHORT":
        amount = entry - reference
    else:  # LONG (default)
        amount = reference - entry

    out["gainLossAmount"] = round(amount, 4)
    out["gainLossPercent"] = round(amount / entry * 100, 2)
    if op.Cantidad is not None:
        out["totalGainLossAmount"] = round(amount * float(op.Cantidad), 2)
    return out
