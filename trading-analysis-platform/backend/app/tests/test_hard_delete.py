"""Tests de borrado PERMANENTE de usuarios y contraseña temporal (admin)."""
from __future__ import annotations

from sqlalchemy import delete, select

from app.models import (
    AnalisisDibujo,
    CatalogoUsuarioAccion,
    ConfiguracionScorecard,
    IndicadorConfiguracion,
    LayoutGrafica,
    PasswordToken,
    Usuario,
)
from app.repositories.password_tokens_repository import PasswordTokensRepository
from app.repositories.users_repository import UsersRepository
from app.tests.conftest import login_headers, make_user

DRAWING_PAYLOAD = {
    "symbol": "AAPL",
    "sourceTimeframe": "1Y_1D",
    "type": "free_line",
    "points": [{"time": 1700000000000, "price": 100.0}, {"time": 1700600000000, "price": 110.0}],
    "style": {"color": "#fff", "width": 2, "lineStyle": "solid", "opacity": 1},
}

INDICATOR_PAYLOAD = [
    {
        "id": "sma-200",
        "type": "SMA",
        "name": "SMA 200",
        "visible": True,
        "applyToAllTimeframes": True,
        "params": {"period": 200},
        "style": {},
    }
]


def _seed_user_with_data(client, db_session, username="Victima", email="victima@example.com"):
    """Crea un usuario con filas en TODAS las tablas hijas + un token."""
    user = make_user(db_session, username, email)
    headers = login_headers(client, username)
    ws = client.get("/api/layouts/stock/AAPL", headers=headers).json()[0]["c030Id"]
    assert client.post(
        "/api/drawings", json={**DRAWING_PAYLOAD, "c030Id": ws}, headers=headers
    ).status_code in (200, 201)
    assert client.put("/api/indicators", json=INDICATOR_PAYLOAD, headers=headers).status_code == 200
    assert client.put("/api/layouts/default", json={"theme": "dark"}, headers=headers).status_code == 200
    assert client.post("/api/catalog", json={"symbol": "AAPL"}, headers=headers).status_code == 201
    # Config de scorecard (C081): la crea el endpoint default.
    assert client.get("/api/scorecard/configs/default", headers=headers).status_code == 200
    PasswordTokensRepository(db_session).create_token(user.C005Id, "hash-x" + username, "RESET_PASSWORD", 1)
    db_session.commit()
    return user


def _count(db, model, user_id) -> int:
    return len(list(db.execute(select(model).where(model.C005Id == user_id)).scalars()))


def test_admin_hard_deletes_user_and_all_child_records(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    target = _seed_user_with_data(client, db_session)
    target_id = target.C005Id

    # Precondicion: hay filas hijas en las 5 tablas.
    for model in (PasswordToken, AnalisisDibujo, IndicadorConfiguracion, LayoutGrafica, CatalogoUsuarioAccion, ConfiguracionScorecard):
        assert _count(db_session, model, target_id) >= 1, model.__name__

    headers = login_headers(client, "Root")
    res = client.delete(f"/api/admin/users/{target_id}/hard-delete", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json() == {"success": True, "message": "User permanently deleted"}

    # Todas las tablas hijas y el usuario quedaron sin rastro.
    for model in (PasswordToken, AnalisisDibujo, IndicadorConfiguracion, LayoutGrafica, CatalogoUsuarioAccion, ConfiguracionScorecard):
        assert _count(db_session, model, target_id) == 0, model.__name__
    assert db_session.get(Usuario, target_id) is None


def test_hard_delete_rolls_back_if_child_delete_fails(client, db_session, monkeypatch):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    target = _seed_user_with_data(db_session=db_session, client=client)
    target_id = target.C005Id

    def boom(self, user):
        # Borra tokens y luego falla: nada debe quedar aplicado.
        self.db.execute(delete(PasswordToken).where(PasswordToken.C005Id == user.C005Id))
        raise RuntimeError("fallo simulado")

    monkeypatch.setattr(UsersRepository, "hard_delete_user", boom)
    headers = login_headers(client, "Root")
    res = client.delete(f"/api/admin/users/{target_id}/hard-delete", headers=headers)
    assert res.status_code == 500
    assert "ningún cambio" in res.json()["detail"]

    db_session.expire_all()
    # Rollback: el token sigue existiendo y el usuario tambien.
    assert _count(db_session, PasswordToken, target_id) >= 1
    assert db_session.get(Usuario, target_id) is not None


def test_admin_cannot_hard_delete_self(client, db_session):
    admin = make_user(db_session, "Root", "root@example.com", es_admin=True)
    headers = login_headers(client, "Root")
    res = client.delete(f"/api/admin/users/{admin.C005Id}/hard-delete", headers=headers)
    assert res.status_code == 400
    assert "propio usuario" in res.json()["detail"]
    assert db_session.get(Usuario, admin.C005Id) is not None


def test_cannot_hard_delete_last_active_admin(client, db_session):
    # Con un solo admin activo, la unica via de borrarlo es a si mismo: bloqueado.
    admin = make_user(db_session, "Root", "root@example.com", es_admin=True)
    headers = login_headers(client, "Root")
    res = client.delete(f"/api/admin/users/{admin.C005Id}/hard-delete", headers=headers)
    assert res.status_code == 400
    assert UsersRepository(db_session).count_active_admins() == 1


def test_admin_can_hard_delete_other_admin_if_not_last(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    other = make_user(db_session, "Admin2", "admin2@example.com", es_admin=True)
    headers = login_headers(client, "Root")
    res = client.delete(f"/api/admin/users/{other.C005Id}/hard-delete", headers=headers)
    assert res.status_code == 200
    assert db_session.get(Usuario, other.C005Id) is None


def test_hard_delete_requires_admin(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    target = make_user(db_session, "Normal", "normal@example.com")
    headers = login_headers(client, "Normal")
    res = client.delete(f"/api/admin/users/{target.C005Id}/hard-delete", headers=headers)
    assert res.status_code == 403


def test_hard_delete_missing_user_404(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    headers = login_headers(client, "Root")
    res = client.delete("/api/admin/users/9999/hard-delete", headers=headers)
    assert res.status_code == 404


# ===== Contraseña temporal =====


def test_set_temporary_password_allows_login_and_forces_change(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    target = make_user(db_session, "Temporal", "temporal@example.com")
    headers = login_headers(client, "Root")
    res = client.post(
        f"/api/admin/users/{target.C005Id}/set-temporary-password",
        json={"temporaryPassword": "Temporal123"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    assert "Temporal123" not in str(body)  # nunca se devuelve la contraseña

    # Por defecto requireChange=True: login OK pero con flag de cambio forzado.
    login = client.post(
        "/api/auth/login", json={"username": "Temporal", "password": "Temporal123"}
    )
    assert login.status_code == 200
    assert login.json()["user"]["debeCambiarPassword"] is True


def test_set_temporary_password_without_require_change(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    target = make_user(db_session, "Temporal", "temporal@example.com")
    headers = login_headers(client, "Root")
    res = client.post(
        f"/api/admin/users/{target.C005Id}/set-temporary-password",
        json={"temporaryPassword": "Temporal123", "requireChange": False},
        headers=headers,
    )
    assert res.status_code == 200
    login = client.post(
        "/api/auth/login", json={"username": "Temporal", "password": "Temporal123"}
    )
    assert login.status_code == 200
    assert login.json()["user"]["debeCambiarPassword"] is False


def test_non_admin_cannot_set_temporary_password(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    target = make_user(db_session, "Otro", "otro@example.com")
    normal = make_user(db_session, "Normal", "normal@example.com")
    headers = login_headers(client, "Normal")
    res = client.post(
        f"/api/admin/users/{target.C005Id}/set-temporary-password",
        json={"temporaryPassword": "Temporal123"},
        headers=headers,
    )
    assert res.status_code == 403
    assert normal is not None


def test_force_password_change(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    target = make_user(db_session, "Objetivo", "objetivo@example.com")
    headers = login_headers(client, "Root")
    res = client.post(
        f"/api/admin/users/{target.C005Id}/force-password-change", headers=headers
    )
    assert res.status_code == 200
    db_session.expire_all()
    assert bool(db_session.get(Usuario, target.C005Id).DebeCambiarPassword) is True


def test_set_temporary_password_rejects_weak(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    target = make_user(db_session, "Temporal", "temporal@example.com")
    headers = login_headers(client, "Root")
    res = client.post(
        f"/api/admin/users/{target.C005Id}/set-temporary-password",
        json={"temporaryPassword": "corta"},
        headers=headers,
    )
    assert res.status_code == 400
