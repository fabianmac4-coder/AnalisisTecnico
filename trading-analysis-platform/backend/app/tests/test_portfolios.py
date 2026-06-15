"""Tests de Portfolio Analysis (Fase 4). Sin red: se mockea yahoo_service."""
from __future__ import annotations

import pytest

from app.models import Portafolio, PosicionPortafolio
from app.repositories.users_repository import UsersRepository
from app.schemas.market import QuoteResponse
from app.services import yahoo_service
from app.tests.conftest import login_headers, make_user


@pytest.fixture(autouse=True)
def _mock_yahoo(monkeypatch):
    """Cotización y fundamentales mockeados (offline, deterministas)."""
    monkeypatch.setattr(
        yahoo_service, "get_quote",
        lambda s, force_refresh=False: QuoteResponse(
            symbol=s, price=100.0, previousClose=99.0, change=1.0, changePercent=1.0,
            currency="USD", marketState="REGULAR", source="test", timestamp=0,
        ),
    )
    monkeypatch.setattr(
        yahoo_service, "get_fundamentals",
        lambda s, force_refresh=False: {"longName": f"{s} Inc", "sector": "Technology"},
    )
    return monkeypatch


def _auth(client, db_session, name="Ana", email="ana@example.com"):
    make_user(db_session, name, email)
    return login_headers(client, name)


def _new_portfolio(client, headers, name="Largo plazo") -> int:
    res = client.post("/api/portfolios", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["c090Id"]


def _add(client, headers, c090, ticker, qty, avg, sector=None):
    body = {"ticker": ticker, "quantity": qty, "averageCost": avg}
    if sector:
        body["sector"] = sector
    return client.post(f"/api/portfolios/{c090}/positions", json=body, headers=headers)


# --------------------------------------------------------------------------
# Auth + CRUD portafolios
# --------------------------------------------------------------------------
def test_list_requires_auth(client):
    assert client.get("/api/portfolios").status_code == 401


def test_create_portfolio_scoped_to_user(client, db_session):
    headers = _auth(client, db_session)
    c090 = _new_portfolio(client, headers)
    row = db_session.get(Portafolio, c090)
    assert row.C005Id == 1 and row.EsDefault is True  # primero => default


def test_user_cannot_access_other_users_portfolio(client, db_session):
    h1 = _auth(client, db_session, "Ana", "ana@x.com")
    c090 = _new_portfolio(client, h1)
    h2 = _auth(client, db_session, "Bob", "bob@x.com")
    assert client.get(f"/api/portfolios/{c090}/positions", headers=h2).status_code == 404
    assert client.patch(f"/api/portfolios/{c090}", json={"name": "X"}, headers=h2).status_code == 404
    assert client.delete(f"/api/portfolios/{c090}", headers=h2).status_code == 404


def test_patch_and_delete_only_own(client, db_session):
    headers = _auth(client, db_session)
    c090 = _new_portfolio(client, headers)
    r = client.patch(f"/api/portfolios/{c090}", json={"name": "Nuevo"}, headers=headers)
    assert r.status_code == 200 and r.json()["name"] == "Nuevo"
    assert client.delete(f"/api/portfolios/{c090}", headers=headers).status_code == 204
    # Soft delete: ya no aparece.
    assert client.get("/api/portfolios", headers=headers).json() == []


def test_set_default_unsets_others(client, db_session):
    headers = _auth(client, db_session)
    a = _new_portfolio(client, headers, "A")
    b = _new_portfolio(client, headers, "B")
    client.patch(f"/api/portfolios/{b}/set-default", headers=headers)
    by_id = {p["c090Id"]: p for p in client.get("/api/portfolios", headers=headers).json()}
    assert by_id[b]["isDefault"] is True and by_id[a]["isDefault"] is False


# --------------------------------------------------------------------------
# Posiciones
# --------------------------------------------------------------------------
def test_add_position_stores_user_and_portfolio(client, db_session):
    headers = _auth(client, db_session)
    c090 = _new_portfolio(client, headers)
    res = _add(client, headers, c090, "AAPL", 10, 150.0)
    assert res.status_code == 201, res.text
    pos = db_session.query(PosicionPortafolio).filter_by(Ticker="AAPL").one()
    assert pos.C005Id == 1 and pos.C090Id == c090 and pos.NombreInstrumento == "AAPL Inc"


def test_position_quantity_must_be_positive(client, db_session):
    headers = _auth(client, db_session)
    c090 = _new_portfolio(client, headers)
    assert _add(client, headers, c090, "AAPL", 0, 150.0).status_code == 422
    assert _add(client, headers, c090, "AAPL", -5, 150.0).status_code == 422


def test_position_avg_cost_non_negative(client, db_session):
    headers = _auth(client, db_session)
    c090 = _new_portfolio(client, headers)
    assert _add(client, headers, c090, "AAPL", 10, -1.0).status_code == 422


def test_user_cannot_access_other_users_position(client, db_session):
    h1 = _auth(client, db_session, "Ana", "ana@x.com")
    c090 = _new_portfolio(client, h1)
    c091 = _add(client, h1, c090, "AAPL", 10, 150.0).json()["c091Id"]
    h2 = _auth(client, db_session, "Bob", "bob@x.com")
    assert client.patch(f"/api/portfolios/positions/{c091}", json={"quantity": 5}, headers=h2).status_code == 404
    assert client.delete(f"/api/portfolios/positions/{c091}", headers=h2).status_code == 404


# --------------------------------------------------------------------------
# Análisis
# --------------------------------------------------------------------------
def test_analysis_calculations(client, db_session):
    headers = _auth(client, db_session)
    c090 = _new_portfolio(client, headers)
    _add(client, headers, c090, "AAPL", 10, 80.0)  # costBasis 800; price 100 -> value 1000
    a = client.get(f"/api/portfolios/{c090}/analysis", headers=headers).json()
    s = a["summary"]
    assert s["totalCost"] == 800.0
    assert s["currentValue"] == 1000.0
    assert s["totalGainLoss"] == 200.0
    assert s["totalGainLossPercent"] == 25.0
    assert s["positionCount"] == 1
    assert a["positions"][0]["portfolioWeight"] == 100.0


def test_concentration_warning_above_20pct(client, db_session):
    headers = _auth(client, db_session)
    c090 = _new_portfolio(client, headers)
    _add(client, headers, c090, "AAPL", 100, 50.0)  # única posición -> 100%
    a = client.get(f"/api/portfolios/{c090}/analysis", headers=headers).json()
    assert a["risk"]["concentrationRisk"]["flagged"] is True
    assert any(r["type"] == "CONCENTRATION" for r in a["recommendations"])


def test_sector_warning_above_40pct(client, db_session):
    headers = _auth(client, db_session)
    c090 = _new_portfolio(client, headers)
    # Tech ~50% (AAPL+MSFT) vs Salud ~50% (JNJ): tech > 40 -> recomendación SECTOR.
    _add(client, headers, c090, "AAPL", 50, 80.0, sector="Technology")
    _add(client, headers, c090, "MSFT", 50, 80.0, sector="Technology")
    _add(client, headers, c090, "JNJ", 100, 80.0, sector="Healthcare")
    a = client.get(f"/api/portfolios/{c090}/analysis", headers=headers).json()
    assert any(r["type"] == "SECTOR" for r in a["recommendations"])
    assert a["risk"]["sectorRisk"]["largestSectorWeight"] >= 40


def test_quote_failure_returns_warning_not_crash(client, db_session, monkeypatch):
    headers = _auth(client, db_session)
    c090 = _new_portfolio(client, headers)
    _add(client, headers, c090, "AAPL", 10, 80.0)
    # Ahora la cotización falla: el análisis no debe romperse.
    monkeypatch.setattr(yahoo_service, "get_quote",
                        lambda s, force_refresh=False: (_ for _ in ()).throw(RuntimeError()))
    a = client.get(f"/api/portfolios/{c090}/analysis", headers=headers).json()
    assert a["summary"]["currentValue"] is None
    assert a["positions"][0]["dataWarnings"]
    assert a["warnings"]


# --------------------------------------------------------------------------
# Hard delete usuario elimina C090/C091
# --------------------------------------------------------------------------
def test_hard_delete_user_removes_portfolios_and_positions(client, db_session):
    headers = _auth(client, db_session)
    c090 = _new_portfolio(client, headers)
    _add(client, headers, c090, "AAPL", 10, 150.0)
    user = make_user(db_session, "Temp", "temp@x.com")  # otro usuario distinto
    # El usuario 1 (Ana) tiene portafolio + posición; lo borramos físicamente.
    ana = UsersRepository(db_session).get_by_id(1)
    UsersRepository(db_session).hard_delete_user(ana)
    db_session.commit()
    assert db_session.query(Portafolio).filter_by(C005Id=1).count() == 0
    assert db_session.query(PosicionPortafolio).filter_by(C005Id=1).count() == 0
    assert user is not None
