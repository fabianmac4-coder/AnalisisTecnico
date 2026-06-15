"""Tests de entradas simuladas / paper trading (dbo.C050)."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Accion, OperacionSimulada
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.operaciones_simuladas_repository import calculate_performance
from app.routers import operaciones_simuladas
from app.services import ai_context_service, news_service
from app.tests.conftest import login_headers, make_user

ENTRY = {
    "symbol": "AAPL",
    "type": "LONG",
    "entryPrice": 185.25,
    "quantity": 10,
    "entryDate": "2026-05-01T14:30:00",
    "sourceTimeframe": "1Y_1D",
    "name": "Entrada de prueba cerca de soporte",
    "notes": "Entrada hipotética",
    "color": "#22c55e",
}


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    monkeypatch.setattr(operaciones_simuladas, "_current_price", lambda symbol: 195.30)
    monkeypatch.setattr(news_service, "get_symbol_news", lambda *a, **k: [])
    monkeypatch.setattr(
        ai_context_service,
        "_market_summary",
        lambda symbol: {
            "market_data_available": True,
            "quote": {"price": 195.30},
        },
    )
    monkeypatch.setattr(ai_context_service, "_weekly_summary", lambda symbol: None)


def _create(client, headers, payload=None) -> dict:
    res = client.post("/api/simulated-trades", json=payload or ENTRY, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_authenticated_user_can_create_entry_with_performance(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    trade = _create(client, headers)
    assert trade["symbol"] == "AAPL"
    assert trade["status"] == "ABIERTA"
    assert trade["entryPrice"] == 185.25
    # Rendimiento LONG con precio actual simulado 195.30.
    assert trade["currentPrice"] == 195.30
    assert trade["gainLossAmount"] == pytest.approx(10.05, abs=0.001)
    assert trade["gainLossPercent"] == pytest.approx(5.43, abs=0.01)
    assert trade["totalGainLossAmount"] == pytest.approx(100.5, abs=0.01)
    assert trade["daysSinceEntry"] >= 0


def test_unauthenticated_cannot_access(client, db_session):
    assert client.get("/api/simulated-trades?symbol=AAPL").status_code == 401
    assert client.post("/api/simulated-trades", json=ENTRY).status_code == 401


def test_user_cannot_see_or_touch_anothers_entries(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    make_user(db_session, "Beto", "beto@example.com")
    ha = login_headers(client, "Ana")
    hb = login_headers(client, "Beto")
    trade = _create(client, ha)

    assert client.get("/api/simulated-trades?symbol=AAPL", headers=hb).json() == []
    assert (
        client.patch(
            f"/api/simulated-trades/{trade['id']}",
            json={"notes": "hack"},
            headers=hb,
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/simulated-trades/{trade['id']}", headers=hb).status_code
        == 404
    )


def test_short_performance_inverts_sign(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    trade = _create(client, headers, {**ENTRY, "type": "SHORT"})
    # SHORT: entrada 185.25, precio actual 195.30 => perdida.
    assert trade["gainLossAmount"] == pytest.approx(-10.05, abs=0.001)
    assert trade["gainLossPercent"] == pytest.approx(-5.43, abs=0.01)


def test_soft_delete_sets_activo_and_visible_off(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    trade = _create(client, headers)
    assert (
        client.delete(f"/api/simulated-trades/{trade['id']}", headers=headers).status_code
        == 204
    )
    db_session.expire_all()
    row = db_session.get(OperacionSimulada, trade["id"])
    assert row is not None  # sigue en la BD (borrado suave)
    assert bool(row.Activo) is False
    assert bool(row.Visible) is False
    assert client.get("/api/simulated-trades?symbol=AAPL", headers=headers).json() == []


def test_close_entry_stores_exit_and_realized_result(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    trade = _create(client, headers)
    res = client.post(
        f"/api/simulated-trades/{trade['id']}/close",
        json={"exitPrice": 201.50, "exitDate": "2026-06-01T10:00:00", "reason": "Objetivo alcanzado"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "CERRADA"
    assert body["exitPrice"] == 201.50
    assert body["exitReason"] == "Objetivo alcanzado"
    # Resultado REALIZADO con PrecioSalida (no precio actual).
    assert body["gainLossAmount"] == pytest.approx(16.25, abs=0.001)
    assert body["gainLossPercent"] == pytest.approx(8.77, abs=0.01)


def test_remove_from_watchlist_does_not_delete_c050(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    trade = _create(client, headers)
    client.post("/api/catalog", json={"symbol": "AAPL"}, headers=headers)
    accion = AccionesRepository(db_session).get_by_yahoo_symbol("AAPL")

    assert client.delete(f"/api/catalog/{accion.C010Id}", headers=headers).status_code == 204
    db_session.expire_all()
    row = db_session.get(OperacionSimulada, trade["id"])
    assert row is not None and bool(row.Activo) is True
    assert db_session.get(Accion, accion.C010Id) is not None


def test_hard_delete_user_removes_c050(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    target = make_user(db_session, "Victima", "victima@example.com")
    ht = login_headers(client, "Victima")
    _create(client, ht)

    hr = login_headers(client, "Root")
    res = client.delete(f"/api/admin/users/{target.C005Id}/hard-delete", headers=hr)
    assert res.status_code == 200, res.text
    assert list(db_session.execute(select(OperacionSimulada)).scalars()) == []


def test_ai_context_includes_simulated_entries(client, db_session):
    user = make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    _create(client, headers)
    accion = AccionesRepository(db_session).get_by_yahoo_symbol("AAPL")

    context = ai_context_service.build_stock_context(
        db_session,
        user_id=user.C005Id,
        c010_id=accion.C010Id,
        symbol="AAPL",
        include_chart_context=True,
        include_drawings=False,
        include_indicators=False,
        include_news=False,
    )
    entries = context["simulatedEntries"]
    assert len(entries) == 1
    assert entries[0]["entryPrice"] == 185.25
    assert entries[0]["gainLossPercent"] == pytest.approx(5.43, abs=0.01)
    text = ai_context_service.context_to_text(context)
    assert "PasswordHash" not in text and user.PasswordHash not in text

    # Y el contexto del modo ChatGPT tambien las incluye.
    ctx2 = ai_context_service.build_chatgpt_context(db_session, user.C005Id, "AAPL")
    assert len(ctx2["simulatedEntries"]) == 1


def test_calculate_performance_handles_missing_price(db_session):
    make_user(db_session, "Ana", "ana@example.com")
    from app.repositories.operaciones_simuladas_repository import (
        OperacionesSimuladasRepository,
    )
    from datetime import datetime

    accion = AccionesRepository(db_session).get_or_create_from_yahoo_symbol("AAPL")
    op = OperacionesSimuladasRepository(db_session).create_entry(
        user_id=1,
        c010_id=accion.C010Id,
        tipo="LONG",
        precio_entrada=100.0,
        fecha_entrada=datetime(2026, 5, 1),
    )
    perf = calculate_performance(op, None)
    assert perf["gainLossPercent"] is None
    assert perf["currentPrice"] is None
    assert perf["daysSinceEntry"] >= 0


# ===== Workspace + snapshot de análisis (C030Id / MetadataJSON / AnalisisJSON) =====
def _ws(client, headers, symbol="AAPL") -> int:
    return client.get(f"/api/layouts/stock/{symbol}", headers=headers).json()[0]["c030Id"]


def test_entry_saves_workspace_and_snapshot(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    c030 = _ws(client, headers)
    payload = {
        **ENTRY,
        "c030Id": c030,
        "entryThesis": "Retest de breakout",
        "bullishScenario": "Aguanta SMA50",
        "invalidationLevel": 176.0,
        "metadata": {"chartContextKey": "1Y_1h", "nearestCandleClose": 185.8},
        "analysisSnapshot": {"scorecard": {"overallScore": 72}},
    }
    trade = _create(client, headers, payload)
    assert trade["c030Id"] == c030

    # El detalle devuelve metadata y analysisSnapshot parseados.
    detail = client.get(f"/api/simulated-trades/{trade['id']}", headers=headers).json()
    assert detail["metadata"]["chartContextKey"] == "1Y_1h"
    assert detail["analysisSnapshot"]["scorecard"]["overallScore"] == 72
    assert detail["analysisSnapshot"]["simulatedEntryThesis"]["scenario"] == "Retest de breakout"
    assert detail["analysisSnapshot"]["simulatedEntryThesis"]["invalidation"] == 176.0


def test_entry_create_accurate_price_and_date(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    trade = _create(client, headers, {**ENTRY, "c030Id": _ws(client, headers)})
    assert trade["entryPrice"] == 185.25
    assert trade["entryDate"].startswith("2026-05-01T14:30:00")


def test_list_filters_by_workspace(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    w1 = _ws(client, headers)
    w2 = client.post(
        "/api/layouts/stock/AAPL", json={"name": "Short"}, headers=headers
    ).json()["c030Id"]
    _create(client, headers, {**ENTRY, "c030Id": w1})

    in_w1 = client.get(
        "/api/simulated-trades", params={"symbol": "AAPL", "c030Id": w1}, headers=headers
    ).json()
    in_w2 = client.get(
        "/api/simulated-trades", params={"symbol": "AAPL", "c030Id": w2}, headers=headers
    ).json()
    assert len(in_w1) == 1
    # w2 no tiene entradas propias (la de w1 no se cuela; las heredadas NULL sí, pero no hay).
    assert all(t["c030Id"] == w2 or t["c030Id"] is None for t in in_w2)
    assert not any(t["c030Id"] == w1 for t in in_w2)


def test_edit_thesis_preserves_snapshot(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    trade = _create(
        client, headers,
        {**ENTRY, "c030Id": _ws(client, headers),
         "analysisSnapshot": {"scorecard": {"overallScore": 72}}},
    )
    client.patch(
        f"/api/simulated-trades/{trade['id']}",
        json={"thesis": {"scenario": "Actualizado", "targetArea": "210"}},
        headers=headers,
    )
    detail = client.get(f"/api/simulated-trades/{trade['id']}", headers=headers).json()
    # La tesis se actualiza; el snapshot original (scorecard) se conserva.
    assert detail["analysisSnapshot"]["simulatedEntryThesis"]["scenario"] == "Actualizado"
    assert detail["analysisSnapshot"]["scorecard"]["overallScore"] == 72


def test_detail_of_another_user_is_404(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    make_user(db_session, "Beto", "beto@example.com")
    ha = login_headers(client, "Ana")
    hb = login_headers(client, "Beto")
    trade = _create(client, ha, {**ENTRY, "c030Id": _ws(client, ha)})
    res = client.get(f"/api/simulated-trades/{trade['id']}", headers=hb)
    assert res.status_code == 404
