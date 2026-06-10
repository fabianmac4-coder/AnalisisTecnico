"""Ejecuta las migraciones SQL de backend/sql/ contra la base configurada.

Uso:
    python scripts/run_migrations.py

Los scripts son idempotentes (IF NOT EXISTS / COL_LENGTH), asi que correrlos
varias veces es seguro. Cada archivo puede contener varios lotes separados por
lineas "GO" (estilo sqlcmd).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.database import engine  # noqa: E402

SQL_DIR = Path(__file__).resolve().parent.parent / "sql"


def split_batches(sql: str) -> list[str]:
    """Separa por lineas GO (separador de lotes de sqlcmd/SSMS)."""
    batches: list[str] = []
    current: list[str] = []
    for line in sql.splitlines():
        if line.strip().upper() == "GO":
            if current:
                batches.append("\n".join(current))
                current = []
        else:
            current.append(line)
    if current:
        batches.append("\n".join(current))
    return [b for b in batches if b.strip()]


def main() -> None:
    files = sorted(SQL_DIR.glob("*.sql"))
    if not files:
        print(f"No hay archivos .sql en {SQL_DIR}")
        return
    with engine.begin() as conn:
        for f in files:
            print(f"Ejecutando {f.name}...")
            for batch in split_batches(f.read_text(encoding="utf-8")):
                conn.execute(text(batch))
    print(f"OK: {len(files)} migraciones aplicadas.")


if __name__ == "__main__":
    main()
