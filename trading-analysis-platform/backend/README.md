# Backend — Trading Analysis Platform

API FastAPI que consulta Yahoo Finance (via `yfinance`), normaliza los datos
OHLCV y los expone al frontend. Incluye cache en memoria con TTL y repositorios
en memoria preparados para migrar a base de datos.

## Requisitos

- Python 3.10+

## Instalacion y ejecucion

```bash
cd backend
python -m venv .venv
# Linux/Mac:
source .venv/bin/activate
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn app.main:app --reload
```

La API queda en `http://localhost:8000`. Documentacion interactiva en
`http://localhost:8000/docs`.

## Endpoints principales

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/health` | Healthcheck |
| GET | `/api/market/ohlcv?symbol=AAPL&preset=1Y_1D` | Velas normalizadas |
| GET | `/api/market/presets` | Lista de presets del backend |
| GET | `/api/symbols/search?q=AAPL` | Valida/busca un ticker |
| GET/POST/PATCH/DELETE | `/api/catalog` | Catalogo (repo en memoria) |
| GET/POST/PATCH/DELETE | `/api/drawings` | Dibujos (repo en memoria) |
| GET/PUT | `/api/layouts/default` | Layout por defecto |

## Tests

```bash
cd backend
pytest
```

Las pruebas de mercado mockean `yfinance`, asi que corren sin red.

## Configuracion

Variables de entorno (prefijo `TAP_`), ver `app/config.py`:

- `TAP_CACHE_TTL_SECONDS` (default 300)
- `TAP_CORS_ORIGINS`
- `TAP_YAHOO_MAX_RETRIES`
