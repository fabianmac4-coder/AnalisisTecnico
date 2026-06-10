"""Hash y verificacion de contrasenas (passlib + bcrypt)."""
from __future__ import annotations

from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return _pwd_context.verify(plain_password, password_hash)
    except Exception:  # noqa: BLE001 - hash corrupto/ilegible => no autentica
        return False


def validate_password_strength(password: str) -> str | None:
    """Devuelve un mensaje de error o None si la contrasena es valida.

    Reglas: minimo 8 caracteres, al menos una letra y un numero.
    """
    if not password or not password.strip():
        return "La contraseña no puede estar vacía"
    if len(password) < 8:
        return "La contraseña debe tener al menos 8 caracteres"
    if not any(c.isalpha() for c in password):
        return "La contraseña debe incluir al menos una letra"
    if not any(c.isdigit() for c in password):
        return "La contraseña debe incluir al menos un número"
    return None
