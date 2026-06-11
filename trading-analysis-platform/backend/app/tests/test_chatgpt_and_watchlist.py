"""Tests del contexto ChatGPT (iframe) y de las reglas del watchlist (C040)."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import (
    Accion,
    AnalisisDibujo,
    CatalogoUsuarioAccion,
    ChatConversacion,
    ChatMensaje,
)
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.dibujos_repository import DibujosRepository
from app.services import ai_context_service, news_service
from app.tests.conftest import login_headers, make_user


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    monkeypatch.setattr(news_service, "get_symbol_news", lambda *a, **k: [])
    monkeypatch.setattr(
        ai_context_service,
        "_market_summary",
        lambda symbol: {"market_data_available": False},
    )


def _add_aapl_with_data(client, db_session, headers, user):
    """AAPL en catalogo + favorito + un dibujo del usuario."""
    res = client.post("/api/catalog", json={"symbol": "AAPL"}, headers=headers)
    assert res.status_code == 201
    accion = AccionesRepository(db_session).get_by_yahoo_symbol("AAPL")
    client.patch(
        f"/api/catalog/{accion.C010Id}/favorite",
        json={"favorito": True},
        headers=headers,
    )
    client.patch(
        f"/api/catalog/{accion.C010Id}",
        json={"notas": "Esperando pullback a SMA50", "tags": ["AI", "Largo plazo"]},
        headers=headers,
    )
    DibujosRepository(db_session).create(
        user_id=user.C005Id,
        c010_id=accion.C010Id,
        tipo="free_line",
        temporalidad_origen="1Y_1D",
        puntos=[{"time": 1700000000000, "price": 180.0}, {"time": 1705000000000, "price": 195.0}],
        estilo={"color": "#fff"},
    )
    db_session.commit()
    return accion


# ===== Contexto ChatGPT (iframe/helper) =====


def test_chatgpt_context_requires_auth(client, db_session):
    assert client.get("/api/chatgpt/context?symbol=AAPL").status_code == 401


def test_chatgpt_context_returns_own_data_only(client, db_session):
    user = make_user(db_session, "Ana", "ana@example.com")
    make_user(db_session, "Beto", "beto@example.com")
    ha = login_headers(client, "Ana")
    hb = login_headers(client, "Beto")
    _add_aapl_with_data(client, db_session, ha, user)

    ctx_ana = client.get("/api/chatgpt/context?symbol=AAPL", headers=ha).json()
    assert ctx_ana["symbol"] == "AAPL"
    assert ctx_ana["watchlist"]["favorite"] is True
    assert ctx_ana["watchlist"]["notes"] == "Esperando pullback a SMA50"
    assert len(ctx_ana["drawings"]) == 1
    assert len(ctx_ana["timeframes"]) == 6

    # Beto no ve los dibujos/watchlist de Ana.
    ctx_beto = client.get("/api/chatgpt/context?symbol=AAPL", headers=hb).json()
    assert ctx_beto["drawings"] == []
    assert ctx_beto["watchlist"] is None


def test_chatgpt_context_has_no_password_hash(client, db_session):
    user = make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    _add_aapl_with_data(client, db_session, headers, user)
    res = client.get("/api/chatgpt/context?symbol=AAPL", headers=headers)
    assert "PasswordHash" not in res.text
    assert user.PasswordHash not in res.text


def test_chatgpt_context_does_not_write_c110_c111(client, db_session):
    user = make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    _add_aapl_with_data(client, db_session, headers, user)
    client.get("/api/chatgpt/context?symbol=AAPL", headers=headers)
    assert list(db_session.execute(select(ChatConversacion)).scalars()) == []
    assert list(db_session.execute(select(ChatMensaje)).scalars()) == []


# ===== Watchlist (C040) =====


def test_remove_from_watchlist_only_deactivates_c040(client, db_session):
    user = make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    accion = _add_aapl_with_data(client, db_session, headers, user)

    # Tambien una conversacion de IA para verificar que sobrevive.
    conv = client.post(
        "/api/ai/conversations", json={"symbol": "AAPL"}, headers=headers
    ).json()

    res = client.delete(f"/api/catalog/{accion.C010Id}", headers=headers)
    assert res.status_code == 204

    db_session.expire_all()
    # C040 desactivada, NO borrada.
    entry = db_session.execute(
        select(CatalogoUsuarioAccion).where(
            CatalogoUsuarioAccion.C005Id == user.C005Id,
            CatalogoUsuarioAccion.C010Id == accion.C010Id,
        )
    ).scalar_one()
    assert bool(entry.Activo) is False
    # C010 intacta; dibujos y chat intactos.
    assert db_session.get(Accion, accion.C010Id) is not None
    drawings = list(
        db_session.execute(
            select(AnalisisDibujo).where(AnalisisDibujo.C005Id == user.C005Id)
        ).scalars()
    )
    assert len(drawings) == 1
    assert db_session.get(ChatConversacion, conv["id"]) is not None
    # Y desaparece del listado visible.
    listed = client.get("/api/catalog", headers=headers).json()
    assert all(item["id"] != str(accion.C010Id) for item in listed)


def test_favorite_toggle_persists(client, db_session):
    user = make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    accion = _add_aapl_with_data(client, db_session, headers, user)

    res = client.patch(
        f"/api/catalog/{accion.C010Id}/favorite",
        json={"favorito": False},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json() == {"c010Id": accion.C010Id, "ticker": "AAPL", "favorito": False}
    # Persistido: el GET lo refleja.
    listed = client.get("/api/catalog", headers=headers).json()
    assert listed[0]["pinned"] is False

    client.patch(
        f"/api/catalog/{accion.C010Id}/favorite",
        json={"favorito": True},
        headers=headers,
    )
    listed = client.get("/api/catalog", headers=headers).json()
    assert listed[0]["pinned"] is True


def test_favorites_sort_first_in_catalog_list(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    client.post("/api/catalog", json={"symbol": "MSFT"}, headers=headers)
    client.post("/api/catalog", json={"symbol": "AAPL"}, headers=headers)
    accion = AccionesRepository(db_session).get_by_yahoo_symbol("AAPL")
    client.patch(
        f"/api/catalog/{accion.C010Id}/favorite",
        json={"favorito": True},
        headers=headers,
    )
    listed = client.get("/api/catalog", headers=headers).json()
    assert listed[0]["symbol"] == "AAPL"  # favorito primero
    assert listed[0]["pinned"] is True


def test_watchlist_scoped_by_user(client, db_session):
    user = make_user(db_session, "Ana", "ana@example.com")
    make_user(db_session, "Beto", "beto@example.com")
    ha = login_headers(client, "Ana")
    hb = login_headers(client, "Beto")
    accion = _add_aapl_with_data(client, db_session, ha, user)

    # Beto no puede quitar ni marcar favorito del watchlist de Ana.
    assert client.get("/api/catalog", headers=hb).json() == []
    res = client.patch(
        f"/api/catalog/{accion.C010Id}/favorite",
        json={"favorito": False},
        headers=hb,
    )
    # Para Beto se crea SU PROPIA fila (o se ignora); la de Ana queda intacta.
    assert res.status_code == 200
    listed_ana = client.get("/api/catalog", headers=ha).json()
    assert listed_ana[0]["pinned"] is True

    client.delete(f"/api/catalog/{accion.C010Id}", headers=hb)
    listed_ana = client.get("/api/catalog", headers=ha).json()
    assert len(listed_ana) == 1  # el watchlist de Ana sobrevive
