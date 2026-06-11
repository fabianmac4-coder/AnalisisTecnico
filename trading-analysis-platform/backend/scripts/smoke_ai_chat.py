"""Smoke manual del chat de IA contra el backend vivo (no es un test de CI).

Uso: python scripts/smoke_ai_chat.py <usuario> <password>
Verifica: 401 sin token, crear/listar conversaciones, mensaje sin clave
OpenAI -> 503 limpio, y persistencia del mensaje del usuario en C111.
"""
from __future__ import annotations

import sys

import httpx

BASE = "http://127.0.0.1:8000/api"


def main() -> None:
    username, password = sys.argv[1], sys.argv[2]
    with httpx.Client(timeout=30) as client:
        # 1) Sin token -> 401
        r = client.get(f"{BASE}/ai/conversations")
        print(f"1) AI sin token: HTTP {r.status_code} (esperado 401)")

        # 2) Login + crear conversacion
        login = client.post(
            f"{BASE}/auth/login", json={"username": username, "password": password}
        )
        login.raise_for_status()
        headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
        conv = client.post(
            f"{BASE}/ai/conversations", json={"symbol": "AAPL"}, headers=headers
        )
        conv.raise_for_status()
        c = conv.json()
        print(f"2) conversacion creada: #{c['id']} '{c['title']}' symbol={c['symbol']} model={c['model']}")

        # 3) Listar por simbolo
        lst = client.get(f"{BASE}/ai/conversations?symbol=AAPL", headers=headers)
        print(f"3) lista AAPL: {len(lst.json())} conversacion(es)")

        msg_url = f"{BASE}/ai/conversations/{c['id']}/messages"

        # 4) Enviar mensaje sin clave OpenAI -> 503 limpio
        r = client.post(msg_url, json={"message": "Analiza AAPL"}, headers=headers)
        print(f"4) mensaje sin clave OpenAI: HTTP {r.status_code} {r.json().get('detail', '')}")

        # 5) El mensaje del usuario quedo en C111 aunque la IA fallara
        msgs = client.get(msg_url, headers=headers).json()
        roles = [m["role"] for m in msgs]
        print(f"5) mensajes persistidos en C111: {len(msgs)} roles={roles}")

        # 6) Borrado suave
        r = client.delete(f"{BASE}/ai/conversations/{c['id']}", headers=headers)
        lst2 = client.get(f"{BASE}/ai/conversations?symbol=AAPL", headers=headers)
        print(f"6) soft delete: HTTP {r.status_code}; lista tras borrar: {len(lst2.json())}")


if __name__ == "__main__":
    main()
