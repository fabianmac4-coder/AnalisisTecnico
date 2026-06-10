"""Utilidades comunes de los repositorios SQL.

Las tablas originales (C005/C010/C0101/C020/C030/C040) NO usan IDENTITY
(verificado contra la base real), asi que los IDs se calculan con MAX+1.
Suficiente para esta app personal de baja concurrencia; dbo.C006 si es
IDENTITY y no usa esto.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session


def next_id(db: Session, pk_column) -> int:
    """Siguiente ID para tablas sin IDENTITY: ISNULL(MAX(pk), 0) + 1."""
    current = db.execute(select(func.coalesce(func.max(pk_column), 0))).scalar()
    return int(current or 0) + 1


def utcnow() -> datetime:
    """DATETIME sin tz (SQL Server DATETIME no guarda zona horaria)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
