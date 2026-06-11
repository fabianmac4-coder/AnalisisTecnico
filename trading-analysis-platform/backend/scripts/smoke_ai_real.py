"""Smoke manual: mensaje REAL contra OpenAI (requiere OPENAI_API_KEY en .env).

Uso: python scripts/smoke_ai_real.py <usuario> <password>
"""
from __future__ import annotations

import sys

import httpx

BASE = "http://127.0.0.1:8000/api"


def main() -> None:
    username, password = sys.argv[1], sys.argv[2]
    with httpx.Client(timeout=120) as client:
        login = client.post(
            f"{BASE}/auth/login", json={"username": username, "password": password}
        )
        login.raise_for_status()
        headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}

        conv = client.post(
            f"{BASE}/ai/conversations", json={"symbol": "AAPL"}, headers=headers
        )
        conv.raise_for_status()
        cid = conv.json()["id"]
        print(f"conversacion #{cid} creada para AAPL")

        r = client.post(
            f"{BASE}/ai/conversations/{cid}/messages",
            json={
                "message": "Dame un análisis técnico breve de AAPL (3-4 líneas).",
                "includeChartContext": True,
                "includeDrawings": True,
                "includeIndicators": True,
                "includeNews": True,
            },
            headers=headers,
        )
        print(f"HTTP {r.status_code}")
        if r.status_code == 200:
            reply = r.json()["assistantMessage"]["content"]
            print("--- respuesta del asistente ---")
            print(reply[:600])
        else:
            print("detail:", r.json().get("detail"))


if __name__ == "__main__":
    main()
