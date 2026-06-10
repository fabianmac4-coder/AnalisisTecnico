"""Conexion a SQL Server (AnalisisTecnico) via SQLAlchemy + pyodbc.

La base y las tablas YA EXISTEN: aqui NO se ejecuta Base.metadata.create_all()
contra la base real. (Los tests crean el esquema solo en su SQLite efimero.)
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import env_settings

engine = create_engine(
    env_settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
    future=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

Base = declarative_base()


def get_db():
    """Dependencia FastAPI: una sesion por request, siempre cerrada."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
