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

    # OpenAI (chat de IA; vacio => el chat responde 503 "IA no disponible")
    # La clave SOLO vive en el backend: nunca se envia ni loguea.
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5.2"
    OPENAI_TEMPERATURE: float = 0.3
    OPENAI_MAX_OUTPUT_TOKENS: int = 1200
    OPENAI_ENABLE_STREAMING: bool = True
    OPENAI_TIMEOUT_SECONDS: float = 60.0

    # Limites del chat de IA (costo / abuso)
    AI_CHAT_MAX_MESSAGES_PER_MINUTE: int = 10
    AI_CHAT_MAX_CONTEXT_MESSAGES: int = 20
    AI_CHAT_MAX_DRAWINGS_CONTEXT: int = 50
    AI_CHAT_MAX_NEWS_ITEMS: int = 5

    # Noticias y market movers (cache en SQL con TTL corto)
    ENABLE_YAHOO_NEWS_PROVIDER: bool = True
    ENABLE_GOOGLE_NEWS_PROVIDER: bool = True
    GOOGLE_NEWS_REGION: str = "US"
    GOOGLE_NEWS_LANGUAGE: str = "en"
    GOOGLE_NEWS_TIMEOUT_SECONDS: float = 10.0
    GOOGLE_NEWS_GLOBAL_QUERY: str = (
        '"stock market" OR "Federal Reserve" OR inflation OR geopolitics '
        'OR Nasdaq OR "S&P 500"'
    )
    NEWS_SYMBOL_TTL_MINUTES: int = 5
    NEWS_GLOBAL_TTL_MINUTES: int = 5
    MARKET_MOVERS_TTL_MINUTES: int = 5
    NEWS_MAX_ITEMS_PER_PROVIDER: int = 50
    NEWS_CLEANUP_DAYS: int = 30
    MARKET_MOVERS_CLEANUP_DAYS: int = 7

    # Top Trending Stocks Today + agregacion global
    NEWS_TRENDING_STOCKS_TTL_MINUTES: int = 5
    NEWS_TRENDING_STOCKS_MAX_TICKERS: int = 20
    NEWS_TRENDING_STOCKS_NEWS_PER_TICKER: int = 3
    NEWS_GLOBAL_QUERY_LIMIT_PER_QUERY: int = 10
    NEWS_GLOBAL_MAX_QUERIES_PER_REFRESH: int = 30
    NEWS_DEBUG: bool = False

    # Inteligencia de Mercado + Sentimiento (Fase 2; cache compartido en C080).
    ENABLE_MARKET_INTELLIGENCE: bool = True
    ENABLE_MARKET_SENTIMENT: bool = True
    MARKET_INTELLIGENCE_TTL_MINUTES: int = 15
    MARKET_SENTIMENT_TTL_MINUTES: int = 15
    MARKET_INTELLIGENCE_DEBUG: bool = False

    # Macro Dashboard (Fase 3; cache compartido en C080). FRED y el proveedor de
    # calendario son OPCIONALES: sin ellos la página muestra datos parciales.
    ENABLE_MACRO_DASHBOARD: bool = True
    MACRO_CACHE_TTL_MINUTES: int = 60
    MACRO_DEBUG: bool = False
    FRED_API_KEY: str = ""
    FRED_API_BASE_URL: str = "https://api.stlouisfed.org/fred"
    # Series FRED configurables para los indicadores de actividad real. Reemplazan
    # a los ISM PMI (descontinuados gratis en FRED): producción industrial (INDPRO)
    # y ventas minoristas (RSAFS), ambas fiables y disponibles.
    FRED_SERIES_INDUSTRIAL_PRODUCTION: str = "INDPRO"
    FRED_SERIES_RETAIL_SALES: str = "RSAFS"
    ECONOMIC_CALENDAR_PROVIDER: str = ""
    ECONOMIC_CALENDAR_API_KEY: str = ""
    ECONOMIC_CALENDAR_TTL_MINUTES: int = 120

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
