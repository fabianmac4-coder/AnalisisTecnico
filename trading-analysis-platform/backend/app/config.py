"""Configuracion central de la aplicacion.

Todos los valores ajustables (TTL de cache, CORS, etc.) viven aqui para
que sea trivial cambiarlos sin tocar la logica de negocio.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TAP_", env_file=".env", extra="ignore")

    app_name: str = "Trading Analysis Platform API"
    api_prefix: str = "/api"

    # TTL del cache en memoria para respuestas OHLCV, en segundos.
    cache_ttl_seconds: int = 300

    # TTL corto para la cotizacion canonica (precio actual), en seg.
    quote_cache_ttl_seconds: int = 30

    # Origenes permitidos para CORS (frontend de Vite por defecto).
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Si yfinance falla, cuantos reintentos hacer.
    yahoo_max_retries: int = 2


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


class AppEnvSettings(BaseSettings):
    """Configuracion de base de datos, JWT y SMTP (variables SIN prefijo).

    Nada de credenciales hardcodeadas: todo viene de variables de entorno o
    del archivo backend/.env (ver .env.example).
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQL Server (Trusted Connection / Windows Authentication)
    DB_SERVER: str = r"LAPTOP-HIR7OVRK\SQLEXPRESS"
    DB_NAME: str = "AnalisisTecnico"
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"
    DB_TRUSTED_CONNECTION: str = "yes"
    DB_TRUST_CERT: str = "yes"

    # JWT
    JWT_SECRET_KEY: str = "change-this-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Frontend (links de correos de set/reset password)
    FRONTEND_URL: str = "http://localhost:5174"

    # SMTP (vacio => modo desarrollo: no envia, loguea el link)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "Trading Analysis Platform"
    SMTP_FROM_EMAIL: str = ""

    @property
    def database_url(self) -> str:
        """URL de SQLAlchemy construida de forma segura (el server lleva `\\`)."""
        from urllib.parse import quote_plus

        odbc_str = (
            f"DRIVER={{{self.DB_DRIVER}}};"
            f"SERVER={self.DB_SERVER};"
            f"DATABASE={self.DB_NAME};"
            f"Trusted_Connection={self.DB_TRUSTED_CONNECTION};"
            f"TrustServerCertificate={self.DB_TRUST_CERT};"
        )
        return f"mssql+pyodbc:///?odbc_connect={quote_plus(odbc_str)}"


@lru_cache
def get_env_settings() -> AppEnvSettings:
    return AppEnvSettings()


env_settings = get_env_settings()
