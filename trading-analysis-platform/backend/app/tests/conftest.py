"""Infraestructura de tests: SQLite en memoria en lugar de SQL Server.

- get_db se sobreescribe con una sesion SQLite (schema dbo -> sin schema).
- El esquema se crea SOLO en esta base efimera (nunca create_all en la real).
- Helpers para crear usuarios y obtener tokens via login real.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.repositories.users_repository import UsersRepository
from app.security.password import hash_password


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    # Las tablas reales viven en el schema dbo; SQLite no tiene schemas.
    engine = engine.execution_options(schema_translate_map={"dbo": None})
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, future=True)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session):
    def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)


def make_user(
    db,
    username: str,
    email: str,
    password: str = "Password123",
    es_admin: bool = False,
    activo: bool = True,
    debe_cambiar: bool = False,
):
    users = UsersRepository(db)
    user = users.create_user(
        nombre_usuario=username,
        email=email,
        password_hash=hash_password(password),
        es_admin=es_admin,
        debe_cambiar_password=debe_cambiar,
    )
    if not activo:
        user.Activo = False
    db.commit()
    return user


def login_headers(client: TestClient, username: str, password: str = "Password123") -> dict:
    res = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['accessToken']}"}
