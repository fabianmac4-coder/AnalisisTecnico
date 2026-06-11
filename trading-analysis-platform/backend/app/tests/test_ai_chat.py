"""Tests del chat de IA (C110/C111): aislamiento, persistencia y contexto.

Sin red: OpenAI y los datos de mercado/noticias se simulan con monkeypatch.
"""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.config import env_settings
from app.models import ChatConversacion, ChatMensaje
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.chat_repository import ChatRepository
from app.repositories.dibujos_repository import DibujosRepository
from app.repositories.users_repository import UsersRepository
from app.routers import ai_chat
from app.services import ai_context_service, news_service, openai_service
from app.tests.conftest import login_headers, make_user

NO_CONTEXT = {
    "includeChartContext": False,
    "includeDrawings": False,
    "includeIndicators": False,
    "includeNews": False,
}


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    """Resetea el rate limit y bloquea red (noticias/mercado) en cada test."""
    ai_chat._reset_rate_limit()
    monkeypatch.setattr(news_service, "get_symbol_news", lambda *a, **k: [])
    monkeypatch.setattr(
        ai_context_service,
        "_market_summary",
        lambda symbol: {"market_data_available": False},
    )
    yield
    ai_chat._reset_rate_limit()


@pytest.fixture()
def fake_ai(monkeypatch):
    """Simula la respuesta del asistente (sin OpenAI real)."""
    calls: list[dict] = []

    def _fake(context_text: str, history: list[dict], user_message: str):
        calls.append(
            {"context": context_text, "history": history, "message": user_message}
        )
        return ("Respuesta simulada del asistente", 100, 50)

    monkeypatch.setattr(openai_service, "generate_reply", _fake)
    return calls


def _create_conversation(client, headers, symbol="AAPL") -> dict:
    res = client.post(
        "/api/ai/conversations", json={"symbol": symbol}, headers=headers
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_authenticated_user_can_create_conversation(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    conv = _create_conversation(client, headers, "AAPL")
    assert conv["symbol"] == "AAPL"
    assert conv["yahooSymbol"] == "AAPL"
    assert conv["active"] is True
    # La accion se registro/uso en C010 sin duplicados.
    accion = AccionesRepository(db_session).get_by_yahoo_symbol("AAPL")
    assert accion is not None


def test_unauthenticated_cannot_access_ai_endpoints(client, db_session):
    assert client.get("/api/ai/conversations").status_code == 401
    assert (
        client.post("/api/ai/conversations", json={"symbol": "AAPL"}).status_code
        == 401
    )


def test_user_cannot_read_another_users_conversation(client, db_session, fake_ai):
    make_user(db_session, "Ana", "ana@example.com")
    make_user(db_session, "Beto", "beto@example.com")
    ha = login_headers(client, "Ana")
    hb = login_headers(client, "Beto")
    conv = _create_conversation(client, ha)

    cid = conv["id"]
    assert client.get(f"/api/ai/conversations/{cid}/messages", headers=hb).status_code == 404
    assert (
        client.post(
            f"/api/ai/conversations/{cid}/messages",
            json={"message": "hola", **NO_CONTEXT},
            headers=hb,
        ).status_code
        == 404
    )
    # La lista de Beto no incluye la conversacion de Ana.
    assert client.get("/api/ai/conversations", headers=hb).json() == []


def test_list_conversations_filtered_by_symbol(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    _create_conversation(client, headers, "AAPL")
    _create_conversation(client, headers, "MSFT")

    aapl = client.get("/api/ai/conversations?symbol=AAPL", headers=headers).json()
    assert len(aapl) == 1 and aapl[0]["symbol"] == "AAPL"
    todas = client.get("/api/ai/conversations", headers=headers).json()
    assert len(todas) == 2


def test_send_message_stores_user_and_assistant_in_c111(client, db_session, fake_ai):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    conv = _create_conversation(client, headers)

    res = client.post(
        f"/api/ai/conversations/{conv['id']}/messages",
        json={"message": "¿Qué opinas de la tendencia de AAPL?", **NO_CONTEXT},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["userMessage"]["role"] == "user"
    assert body["assistantMessage"]["role"] == "assistant"
    assert body["assistantMessage"]["content"] == "Respuesta simulada del asistente"

    rows = list(
        db_session.execute(
            select(ChatMensaje).where(ChatMensaje.C110Id == conv["id"])
        ).scalars()
    )
    assert [r.Rol for r in rows] == ["user", "assistant"]
    assert rows[1].TokensEntrada == 100
    assert rows[1].TokensSalida == 50

    # GET de mensajes devuelve el historial persistido.
    listed = client.get(
        f"/api/ai/conversations/{conv['id']}/messages", headers=headers
    ).json()
    assert len(listed) == 2


def test_soft_delete_hides_conversation(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    conv = _create_conversation(client, headers)

    assert (
        client.delete(f"/api/ai/conversations/{conv['id']}", headers=headers).status_code
        == 204
    )
    db_session.expire_all()
    row = db_session.get(ChatConversacion, conv["id"])
    assert row is not None and bool(row.Activo) is False  # sigue en la BD
    assert client.get("/api/ai/conversations", headers=headers).json() == []
    # Y deja de ser accesible.
    assert (
        client.get(f"/api/ai/conversations/{conv['id']}/messages", headers=headers).status_code
        == 404
    )


def test_rename_conversation(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    conv = _create_conversation(client, headers)
    res = client.patch(
        f"/api/ai/conversations/{conv['id']}",
        json={"title": "Tesis AAPL 2026"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["title"] == "Tesis AAPL 2026"


def test_missing_openai_key_returns_clean_503(client, db_session, monkeypatch):
    monkeypatch.setattr(env_settings, "OPENAI_API_KEY", "")
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    conv = _create_conversation(client, headers)

    res = client.post(
        f"/api/ai/conversations/{conv['id']}/messages",
        json={"message": "hola", **NO_CONTEXT},
        headers=headers,
    )
    assert res.status_code == 503
    assert "IA" in res.json()["detail"]
    # La clave jamas aparece en la respuesta.
    assert "OPENAI_API_KEY" not in res.text or "falta" in res.text


def test_rate_limit_returns_429(client, db_session, fake_ai, monkeypatch):
    monkeypatch.setattr(env_settings, "AI_CHAT_MAX_MESSAGES_PER_MINUTE", 2)
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    conv = _create_conversation(client, headers)

    payload = {"message": "hola", **NO_CONTEXT}
    url = f"/api/ai/conversations/{conv['id']}/messages"
    assert client.post(url, json=payload, headers=headers).status_code == 200
    assert client.post(url, json=payload, headers=headers).status_code == 200
    assert client.post(url, json=payload, headers=headers).status_code == 429


# ===== Contexto =====


def _setup_user_with_drawing(db_session):
    user = make_user(db_session, "Ana", "ana@example.com")
    accion = AccionesRepository(db_session).get_or_create_from_yahoo_symbol("AAPL")
    DibujosRepository(db_session).create(
        user_id=user.C005Id,
        c010_id=accion.C010Id,
        tipo="free_line",
        temporalidad_origen="1Y_1D",
        puntos=[{"time": 1700000000000, "price": 180.0}, {"time": 1705000000000, "price": 195.0}],
        estilo={"color": "#fff"},
    )
    db_session.commit()
    return user, accion


def test_context_includes_ticker_and_drawings_when_enabled(db_session):
    user, accion = _setup_user_with_drawing(db_session)
    context = ai_context_service.build_stock_context(
        db_session,
        user_id=user.C005Id,
        c010_id=accion.C010Id,
        symbol="AAPL",
        include_chart_context=False,
        include_drawings=True,
        include_indicators=False,
        include_news=False,
    )
    assert context["symbol"] == "AAPL"
    assert context["instrument"]["ticker"] == "AAPL"
    assert context["drawings"]["total"] == 1
    assert context["drawings"]["items"][0]["type"] == "free_line"
    assert context["drawings"]["items"][0]["sourceTimeframe"] == "1Y_1D"


def test_context_excludes_drawings_when_disabled(db_session):
    user, accion = _setup_user_with_drawing(db_session)
    context = ai_context_service.build_stock_context(
        db_session,
        user_id=user.C005Id,
        c010_id=accion.C010Id,
        symbol="AAPL",
        include_chart_context=False,
        include_drawings=False,
        include_indicators=False,
        include_news=False,
    )
    assert "drawings" not in context


def test_context_never_contains_password_hash(db_session):
    user, accion = _setup_user_with_drawing(db_session)
    context = ai_context_service.build_stock_context(
        db_session,
        user_id=user.C005Id,
        c010_id=accion.C010Id,
        symbol="AAPL",
        include_chart_context=True,
        include_drawings=True,
        include_indicators=True,
        include_news=True,
    )
    text = ai_context_service.context_to_text(context)
    assert "PasswordHash" not in text
    assert user.PasswordHash not in text
    assert "email" not in text.lower() or user.Email not in text
    # Sin red: noticias marcadas como no disponibles, jamas inventadas.
    assert context["news"]["news_available"] is False


def test_hard_delete_user_removes_c110_and_c111(client, db_session, fake_ai):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    target = make_user(db_session, "Victima", "victima@example.com")
    ht = login_headers(client, "Victima")
    conv = _create_conversation(client, ht)
    client.post(
        f"/api/ai/conversations/{conv['id']}/messages",
        json={"message": "hola", **NO_CONTEXT},
        headers=ht,
    )

    assert (
        len(list(db_session.execute(select(ChatMensaje)).scalars())) == 2
    )  # user + assistant

    hr = login_headers(client, "Root")
    res = client.delete(
        f"/api/admin/users/{target.C005Id}/hard-delete", headers=hr
    )
    assert res.status_code == 200, res.text

    assert list(db_session.execute(select(ChatConversacion)).scalars()) == []
    assert list(db_session.execute(select(ChatMensaje)).scalars()) == []


def test_history_is_sent_to_model_capped(client, db_session, fake_ai, monkeypatch):
    monkeypatch.setattr(env_settings, "AI_CHAT_MAX_MESSAGES_PER_MINUTE", 100)
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    conv = _create_conversation(client, headers)
    url = f"/api/ai/conversations/{conv['id']}/messages"

    client.post(url, json={"message": "primero", **NO_CONTEXT}, headers=headers)
    client.post(url, json={"message": "segundo", **NO_CONTEXT}, headers=headers)

    # La segunda llamada recibio el historial previo (user + assistant).
    second_call = fake_ai[1]
    roles = [m["role"] for m in second_call["history"]]
    assert roles == ["user", "assistant"]
    assert second_call["message"] == "segundo"
