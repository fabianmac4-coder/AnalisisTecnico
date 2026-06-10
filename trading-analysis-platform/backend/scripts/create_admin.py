"""Crea el PRIMER usuario administrador (bootstrap del sistema).

No hay registro publico: este script es la unica via de crear el primer admin.

Uso:
    python scripts/create_admin.py --username Admin --email admin@example.com --password Admin12345
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.repositories.users_repository import UsersRepository  # noqa: E402
from app.security.password import hash_password, validate_password_strength  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Crear el primer usuario admin")
    parser.add_argument("--username", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    error = validate_password_strength(args.password)
    if error:
        print(f"Password invalida: {error}")
        return 1

    db = SessionLocal()
    try:
        users = UsersRepository(db)
        if users.get_by_username_normalizado(args.username) is not None:
            print(f"Ya existe un usuario con nombre '{args.username}'.")
            return 1
        if users.get_by_email(args.email) is not None:
            print(f"Ya existe un usuario con email '{args.email}'.")
            return 1

        user = users.create_user(
            nombre_usuario=args.username,
            email=args.email,
            password_hash=hash_password(args.password),
            es_admin=True,
            debe_cambiar_password=False,  # el primer admin entra directo
        )
        db.commit()
        print(
            f"Admin creado: C005Id={user.C005Id} usuario='{user.NombreUsuario}' "
            f"email='{user.Email}'"
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
