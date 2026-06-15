"""Suite de seguridad: aislamiento de datos entre usuarios + ataques comunes.

Confirma que un usuario NUNCA accede/edita/borra datos privados de otro y que no
hay escalamiento de privilegios, mass-assignment de campos de propiedad/rol, ni
inyección. Complementa los tests de aislamiento ya existentes por módulo.
"""
from __future__ import annotations

import pytest

from app.models import Usuario
from app.schemas.market import QuoteResponse
from app.services import yahoo_service
from app.services.scorecard_config import DEFAULT_SCORECARD_CONFIG
from app.tests.conftest import login_headers, make_user


@pytest.fixture(autouse=True)
def _mock_yahoo(monkeypatch):
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


def _two_users(client, db_session):
    make_user(db_session, "Ana", "ana@x.com")
    make_user(db_session, "Beto", "beto@x.com")
    return login_headers(client, "Ana"), login_headers(client, "Beto")


# --------------------------------------------------------------------------
# C030 workspaces: aislamiento entre usuarios (hueco no cubierto antes)
# --------------------------------------------------------------------------
def test_workspace_isolation_between_users(client, db_session):
    ha, hb = _two_users(client, db_session)
    ws = client.post("/api/layouts/stock/AAPL", json={"name": "Largo plazo"}, headers=ha)
    assert ws.status_code == 201, ws.text
    c030 = ws.json()["c030Id"]

    # Beto NO ve el workspace de Ana en su lista.
    bob_list = client.get("/api/layouts/stock/AAPL", headers=hb).json()
    assert all(w["c030Id"] != c030 for w in bob_list)

    # Beto NO puede renombrar/borrar/fijar-default el workspace de Ana.
    assert client.patch(f"/api/layouts/{c030}", json={"name": "hack"}, headers=hb).status_code == 404
    assert client.patch(f"/api/layouts/{c030}/set-default", headers=hb).status_code == 404
    assert client.delete(f"/api/layouts/{c030}", headers=hb).status_code == 404
    # Ana sigue teniéndolo intacto.
    assert client.get("/api/layouts/stock/AAPL", headers=ha).json()[0]["name"] == "Largo plazo"


# --------------------------------------------------------------------------
# C0101 drawings: no se puede crear usando el C030 de otro usuario (IDOR)
# --------------------------------------------------------------------------
def test_drawing_cannot_use_another_users_workspace(client, db_session):
    ha, hb = _two_users(client, db_session)
    c030 = client.post("/api/layouts/stock/AAPL", json={"name": "WS"}, headers=ha).json()["c030Id"]
    payload = {
        "symbol": "AAPL", "c030Id": c030, "sourceTimeframe": "1Y_1D",
        "type": "free_line",
        "points": [{"time": 1700000000000, "price": 100}, {"time": 1700001000000, "price": 110}],
    }
    res = client.post("/api/drawings", json=payload, headers=hb)
    assert res.status_code in (400, 403, 404)


# --------------------------------------------------------------------------
# C081 scorecard config: aislamiento (belt-and-suspenders)
# --------------------------------------------------------------------------
def test_scorecard_config_isolation(client, db_session):
    ha, hb = _two_users(client, db_session)
    created = client.post(
        "/api/scorecard/configs",
        json={"name": "Mi perfil", "configuration": DEFAULT_SCORECARD_CONFIG},
        headers=ha,
    )
    assert created.status_code in (200, 201), created.text
    c081 = created.json()["id"] if "id" in created.json() else created.json().get("c081Id")
    # Beto no lo ve ni lo edita.
    assert all(c.get("c081Id", c.get("id")) != c081
               for c in client.get("/api/scorecard/configs", headers=hb).json())
    assert client.patch(f"/api/scorecard/configs/{c081}",
                        json={"name": "hack"}, headers=hb).status_code == 404


# --------------------------------------------------------------------------
# Escalamiento de privilegios y mass-assignment
# --------------------------------------------------------------------------
def test_normal_user_cannot_access_admin_endpoints(client, db_session):
    ha, _hb = _two_users(client, db_session)
    assert client.get("/api/admin/users", headers=ha).status_code == 403
    assert client.post("/api/admin/users", json={
        "nombreUsuario": "x", "email": "x@x.com"}, headers=ha).status_code == 403


def test_update_me_cannot_escalate_to_admin(client, db_session):
    ha, _hb = _two_users(client, db_session)
    # Intenta colar esAdmin/C005Id/Activo por el body: deben ignorarse.
    res = client.patch("/api/auth/me", json={
        "nombreUsuario": "AnaNueva", "esAdmin": True, "EsAdmin": True,
        "C005Id": 999, "activo": False,
    }, headers=ha)
    assert res.status_code == 200, res.text
    # Sigue sin ser admin (no puede entrar a /admin).
    assert client.get("/api/admin/users", headers=ha).status_code == 403
    # En la BD su EsAdmin sigue False y su id no cambió.
    user = db_session.query(Usuario).filter_by(NombreUsuario="AnaNueva").one()
    assert user.EsAdmin is False and user.C005Id == 1


def test_malicious_c005id_in_body_is_ignored(client, db_session):
    ha, hb = _two_users(client, db_session)
    a_id = db_session.query(Usuario.C005Id).filter_by(NombreUsuario="Ana").scalar()
    # Beto intenta crear un portafolio "a nombre de" Ana metiendo C005Id en el body.
    res = client.post("/api/portfolios", json={
        "name": "Inyectado", "C005Id": a_id, "c005Id": a_id,
    }, headers=hb)
    assert res.status_code == 201, res.text
    # El portafolio quedó bajo Beto (token), NO bajo Ana.
    assert all(p["name"] != "Inyectado"
               for p in client.get("/api/portfolios", headers=ha).json())
    assert any(p["name"] == "Inyectado"
               for p in client.get("/api/portfolios", headers=hb).json())


def test_position_cannot_be_added_to_another_users_portfolio(client, db_session):
    ha, hb = _two_users(client, db_session)
    c090 = client.post("/api/portfolios", json={"name": "Ana PF"}, headers=ha).json()["c090Id"]
    res = client.post(f"/api/portfolios/{c090}/positions",
                      json={"ticker": "AAPL", "quantity": 1, "averageCost": 10}, headers=hb)
    assert res.status_code == 404


# --------------------------------------------------------------------------
# Inyección SQL / XSS en inputs: no rompe, no inyecta
# --------------------------------------------------------------------------
def test_sql_injection_and_xss_inputs_are_safe(client, db_session):
    ha, _hb = _two_users(client, db_session)
    evil_ticker = "AAPL'; DROP TABLE C005; --"
    res = client.post("/api/portfolios/{}/positions".format(
        client.post("/api/portfolios", json={"name": "PF"}, headers=ha).json()["c090Id"]
    ), json={"ticker": evil_ticker, "quantity": 1, "averageCost": 10}, headers=ha)
    # No 500; el ORM parametriza, no hay inyección.
    assert res.status_code in (201, 422)
    # La tabla C005 sigue intacta (los usuarios siguen existiendo).
    assert db_session.query(Usuario).count() >= 2
    # Nombre de portafolio con XSS se almacena/escapa como texto, no rompe.
    xss = client.post("/api/portfolios", json={"name": "<script>alert(1)</script>"}, headers=ha)
    assert xss.status_code == 201
    assert xss.json()["name"] == "<script>alert(1)</script>"  # texto literal, no ejecutado


# --------------------------------------------------------------------------
# Cabeceras de seguridad básicas
# --------------------------------------------------------------------------
def test_security_headers_present(client):
    res = client.get("/api/health")
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("Referrer-Policy") == "no-referrer"
