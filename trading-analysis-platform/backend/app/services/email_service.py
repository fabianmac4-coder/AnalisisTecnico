"""Envio de correos de set/reset de password via SMTP.

Comportamiento en desarrollo (SMTP sin configurar):
- NO crashea: devuelve email_sent=False.
- Loguea el link en consola SOLO si la app no corre en "produccion"
  (variable de entorno APP_ENV=production la silencia).
Nunca se envian contrasenas en texto plano.
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import env_settings

logger = logging.getLogger("email_service")


def _smtp_configured() -> bool:
    return bool(env_settings.SMTP_HOST and env_settings.SMTP_FROM_EMAIL)


def _is_production() -> bool:
    return os.environ.get("APP_ENV", "development").lower() == "production"


def _send(to_email: str, subject: str, body: str) -> bool:
    if not _smtp_configured():
        return False
    msg = MIMEMultipart()
    msg["From"] = f"{env_settings.SMTP_FROM_NAME} <{env_settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))
    with smtplib.SMTP(env_settings.SMTP_HOST, env_settings.SMTP_PORT, timeout=20) as server:
        server.starttls()
        if env_settings.SMTP_USER:
            server.login(env_settings.SMTP_USER, env_settings.SMTP_PASSWORD)
        server.sendmail(env_settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
    return True


def _deliver(to_email: str, subject: str, body: str, link: str, kind: str) -> bool:
    """Envia o, en desarrollo sin SMTP, loguea el link (nunca en produccion)."""
    try:
        sent = _send(to_email, subject, body)
    except Exception as exc:  # noqa: BLE001 - el correo no debe tirar la API
        logger.error("Fallo al enviar correo (%s): %s", kind, type(exc).__name__)
        sent = False
    if not sent and not _is_production():
        logger.warning("[DEV] SMTP no configurado. Link de %s para %s: %s", kind, to_email, link)
    return sent


def send_password_setup_email(to_email: str, user_name: str, setup_link: str) -> bool:
    subject = "Set up your Trading Analysis account"
    body = (
        f"Hello {user_name},\n\n"
        "An administrator created an account for you in the Trading Analysis Platform.\n\n"
        "Please set your password using the secure link below:\n\n"
        f"{setup_link}\n\n"
        "This link expires in 24 hours.\n\n"
        "If you did not expect this email, ignore it.\n"
    )
    return _deliver(to_email, subject, body, setup_link, "set-password")


def send_password_reset_email(to_email: str, user_name: str, reset_link: str) -> bool:
    subject = "Reset your Trading Analysis password"
    body = (
        f"Hello {user_name},\n\n"
        "A password reset was requested for your Trading Analysis account.\n\n"
        "Use the secure link below to set a new password:\n\n"
        f"{reset_link}\n\n"
        "This link expires in 1 hour.\n\n"
        "If you did not request this, ignore this email.\n"
    )
    return _deliver(to_email, subject, body, reset_link, "reset-password")
