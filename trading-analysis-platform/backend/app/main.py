"""Punto de entrada de la API FastAPI."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ca_bundle import ensure_ca_bundle

# Configura el CA bundle del sistema (redes con proxy TLS) antes de usar yfinance.
ensure_ca_bundle()

from fastapi import Depends, HTTPException  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.config import env_settings, settings  # noqa: E402
from app.database import get_db  # noqa: E402
from app.routers import (  # noqa: E402
    actions,
    admin_users,
    ai_chat,
    auth,
    catalog,
    chatgpt_context,
    drawings,
    indicators,
    layouts,
    macro,
    market,
    market_intelligence,
    market_movers,
    noticias,
    portfolios,
    operaciones_simuladas,
    scorecard_config,
    stock_scorecard,
    symbols,
    user_preferences,
)
from app.schemas.market import HealthResponse  # noqa: E402
from app.security.dependencies import get_current_active_user  # noqa: E402

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _security_headers(request, call_next):
    """Cabeceras de seguridad básicas (seguras para dev; no rompen la API JSON).

    No incluye HSTS (dev es HTTP) ni CSP (la API solo sirve JSON). En producción
    tras HTTPS conviene añadir Strict-Transport-Security a nivel de proxy.
    """
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response

prefix = settings.api_prefix


@app.get(f"{prefix}/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    return HealthResponse(status="ok", app=settings.app_name)


@app.get(f"{prefix}/health/db", tags=["health"])
def health_db(db: Session = Depends(get_db)) -> dict:
    """Verifica la conexion a SQL Server (sin exponer credenciales)."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - error limpio, sin secretos
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo conectar a la base de datos: {type(exc).__name__}",
        ) from exc
    return {
        "status": "ok",
        "database": env_settings.DB_NAME,
        "server": env_settings.DB_SERVER,
    }


# ===== Publicos: health, login, set-password =====
app.include_router(auth.router, prefix=prefix)

# ===== Protegidos: requieren Bearer token de usuario activo =====
_auth_required = [Depends(get_current_active_user)]
app.include_router(market.router, prefix=prefix, dependencies=_auth_required)
app.include_router(symbols.router, prefix=prefix, dependencies=_auth_required)
app.include_router(catalog.router, prefix=prefix)  # usa el usuario en handlers
app.include_router(drawings.router, prefix=prefix)
app.include_router(layouts.router, prefix=prefix)
app.include_router(user_preferences.router, prefix=prefix)  # preferencias C092 (auth en handler)
app.include_router(indicators.router, prefix=prefix)
app.include_router(actions.router, prefix=prefix)
app.include_router(ai_chat.router, prefix=prefix)  # chat de IA (auth en handlers)
app.include_router(chatgpt_context.router, prefix=prefix)  # contexto ChatGPT iframe
app.include_router(operaciones_simuladas.router, prefix=prefix)  # paper trading
app.include_router(noticias.router, prefix=prefix)  # noticias (cache SQL)
app.include_router(market_movers.router, prefix=prefix)  # movers (cache SQL)
app.include_router(market_intelligence.router, prefix=prefix)  # inteligencia de mercado (C080)
app.include_router(macro.router, prefix=prefix)  # macro dashboard (C080)
app.include_router(portfolios.router, prefix=prefix)  # portfolio analysis (C090/C091)
app.include_router(stock_scorecard.router, prefix=prefix)  # /api/stocks/* (auth en handler)
app.include_router(scorecard_config.router, prefix=prefix)  # /api/scorecard/configs/*

# ===== Solo administradores =====
app.include_router(admin_users.router, prefix=prefix)
