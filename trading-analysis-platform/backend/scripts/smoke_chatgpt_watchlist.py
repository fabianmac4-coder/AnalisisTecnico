"""Smoke manual del contexto ChatGPT y reglas de watchlist (backend vivo)."""
from __future__ import annotations

import sys

import httpx

BASE = "http://127.0.0.1:8000/api"


def main() -> None:
    username, password = sys.argv[1], sys.argv[2]
    with httpx.Client(timeout=60) as client:
        # 1) contexto ChatGPT sin token -> 401
        r = client.get(f"{BASE}/chatgpt/context?symbol=AAPL")
        print(f"1) contexto sin token: HTTP {r.status_code} (esperado 401)")

        login = client.post(
            f"{BASE}/auth/login", json={"username": username, "password": password}
        )
        login.raise_for_status()
        h = {"Authorization": f"Bearer {login.json()['accessToken']}"}

        # 2) contexto ChatGPT con token
        ctx = client.get(f"{BASE}/chatgpt/context?symbol=AAPL", headers=h).json()
        print(
            f"2) contexto AAPL: quote={'si' if ctx.get('quote') else 'no'}, "
            f"dibujos={len(ctx.get('drawings', []))}, "
            f"watchlist={'si' if ctx.get('watchlist') else 'no'}, "
            f"timeframes={len(ctx.get('timeframes', []))}"
        )
        assert "PasswordHash" not in str(ctx)
        print("3) sin PasswordHash en el contexto: ok")

        # 4) favorito: marcar y verificar persistencia + orden
        catalog = client.get(f"{BASE}/catalog", headers=h).json()
        if not catalog:
            client.post(f"{BASE}/catalog", json={"symbol": "AAPL"}, headers=h)
            catalog = client.get(f"{BASE}/catalog", headers=h).json()
        c010_id = catalog[0]["id"]
        fav = client.patch(
            f"{BASE}/catalog/{c010_id}/favorite", json={"favorito": True}, headers=h
        ).json()
        print(f"4) favorito: {fav}")
        listed = client.get(f"{BASE}/catalog", headers=h).json()
        print(f"5) lista tras favorito: primero={listed[0]['symbol']} pinned={listed[0]['pinned']}")


if __name__ == "__main__":
    main()
