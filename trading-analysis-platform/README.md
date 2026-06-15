# Trading Analysis Platform

Plataforma **personal** de análisis técnico de acciones. Permite buscar
tickers, consultar datos de mercado desde Yahoo Finance (vía `yfinance` en el
backend) y visualizar **seis gráficas por temporalidad**. El dashboard de seis
gráficas es el **único espacio de trabajo**: los dibujos son globales a las seis
temporalidades (se proyectan con coordenadas tiempo/precio) y se filtran y
colorean por su temporalidad de origen.

Desde la versión SQL, la plataforma usa **SQL Server** como persistencia
(dibujos, catálogo, layouts, indicadores, usuarios) y **autenticación JWT**:
no hay registro público — un administrador crea las cuentas y cada usuario
define su contraseña mediante un **enlace enviado por correo**.

> No usa branding ni servicios privados de TradingView. La librería de gráficas
> es **Lightweight Charts** (open source). Toda la experiencia es propia.

## Características

- 🔎 Buscador de tickers (AAPL, TSLA, NVDA, MSFT, AMZN, META, SPY, QQQ…).
- ⭐ Catálogo lateral (watchlist) persistente con favoritos.
- 🧱 Seis temporalidades: `4Y_1W` (semanal), `1Y_1D`, `6M_1D`, `3M_1D`,
  `1M_1H`, `1W_30M`.
- 📊 Tipos de gráfica: velas, barras OHLC, línea, área, histograma de volumen.
- ✏️ Línea libre (Free Line) guardada en **coordenadas reales (tiempo/precio)**,
  no en píxeles. **Global a las seis gráficas**, proyectada al rango visible.
- 🎚️ Toolbar global de dibujos: mostrar/ocultar por temporalidad de origen,
  **color por temporalidad** (color picker) y borrado por temporalidad (con
  confirmación). Persistido.
- 📈 Indicadores **globales** aplicados a las seis gráficas, cada panel
  calculado con SUS propias velas: SMA 20/50/200, EMA 9/21, **Bollinger Bands**,
  **Volumen** (histograma con escala propia), **RSI** (panel inferior con
  niveles 70/50/30) y **MACD** (línea, señal e histograma ±). Todos con
  **parámetros editables** (popover "ƒ Indicadores" → ⚙: periodo, fuente
  close/open/high/low/hl2/hlc3/ohlc4, colores, stdDev, niveles RSI, periodos
  MACD con validación fast<slow) y persistidos. Para que SMA 200 y similares
  salgan completos, el backend entrega **velas de warmup**
  (`includeWarmup=true&warmupBars=N`) separadas de las visibles: se usan solo
  para calcular, nunca se pintan como candles.
- 🌙 Tema oscuro tipo terminal de trading.
- 🧩 Tolerancia a fallos parciales: si una gráfica falla, las demás siguen.
- 🔐 **Autenticación JWT** (login por usuario o email), datos **por usuario**
  en SQL Server, panel de **administración de usuarios** (`/admin/users`) y
  alta de contraseñas vía **enlace de correo de un solo uso** (nunca se envían
  contraseñas en texto plano).
- ✨ **AI Chat por ticker** (OpenAI): panel lateral para conversar sobre el
  instrumento activo usando el contexto real de la plataforma (precio, OHLCV,
  indicadores, **tus dibujos**, watchlist y noticias). Historial guardado por
  usuario y acción en SQL (`C110`/`C111`).
- 🤖 **Modo ChatGPT (iframe/helper)**: alternativa SIN API — genera un prompt
  detallado con el contexto del ticker (precio, indicadores, dibujos, notas y
  favorito del watchlist), lo copias y usas tu propia sesión de ChatGPT
  (iframe o pestaña nueva). No guarda nada en la plataforma.
  > Las respuestas de la IA son análisis informativo; **no son asesoría
  > financiera**.

## Gráficas personalizables y workspaces de análisis

El dashboard mantiene **seis paneles de gráfica**, pero cada panel es
**configurable de forma independiente** y se puede tener **varios workspaces
(pestañas) de análisis por acción**.

- **Rango / intervalo por panel.** Cada uno de los seis paneles elige su propio
  rango visible y temporalidad de vela con los selectores de su cabecera:
  - Rangos: `5Y`, `1Y`, `6M`, `3M`, `1M`, `1W`, `1D`.
  - Intervalos: `1mo`, `1wk`, `1d`, `1h`, `30m`, `15m`, `5m`, `1m`.
  - Cambiar el rango/intervalo afecta **solo** ese panel del workspace activo
    (se guarda en `C030.ConfiguracionJSON`) y recarga **solo** ese panel.
- **Workspaces por acción.** Encima de las gráficas, una barra de pestañas
  permite **crear, cambiar, renombrar, duplicar, marcar por defecto y eliminar**
  workspaces. Ejemplo para `AAPL`:
  - `Long-term` → seis gráficas de largo plazo (5Y/1mo, 5Y/1wk, 1Y/1d…).
  - `Short-term` → seis gráficas de corto plazo (1Y/1h, 6M/30m, 3M/15m…).
  - Cambiar la gráfica 1 de `Long-term` **no** afecta a `Short-term`.
- **Persistencia.** Los workspaces se guardan por **usuario + acción** en
  `dbo.C030` (`GET/POST /api/layouts/stock/{symbol}`, `PATCH/DELETE
  /api/layouts/{c030Id}`, `PATCH …/chart-slots`, `PATCH …/set-default`).
  Sobreviven a refrescos de página y a cerrar/abrir sesión. Al abrir una acción
  sin workspaces se crea automáticamente un **"Default Analysis"**.
- **Eliminar un workspace** solo borra (suave, `C030.Activo=0`) esa fila: **no**
  toca dibujos, indicadores, entradas simuladas, chats de IA ni watchlist. No se
  permite borrar el último workspace de una acción.
- **Dibujos AISLADOS por workspace.** Cada dibujo pertenece a un workspace
  (`C0101.C030Id`): una línea creada en *Long-term* no aparece en *Short-term*.
  Al cambiar de pestaña se recargan solo los dibujos de ese workspace; crear un
  dibujo exige un workspace activo (el backend rechaza con 400 los dibujos sin
  `C030Id`). Los dibujos heredados (sin workspace) se muestran solo en el
  workspace por defecto de la acción y nunca se duplican. Dentro de un mismo
  workspace, la temporalidad de origen de un panel es su `contextKey`
  `range_interval` (los seis combos por defecto conservan las claves históricas
  `4Y_1W`/`1Y_1D`/… para no perder dibujos previos). El Channel R/R usa los
  dibujos del workspace activo y de la temporalidad de cada panel.
- **Yahoo Finance.** Algunas combinaciones rango/intervalo no están soportadas
  por el proveedor (p. ej. `5Y/1m`): el panel muestra un **aviso limpio** y
  conserva los datos previos en lugar de romperse. Los selectores deshabilitan
  las combinaciones inválidas. Endpoint: `GET
  /api/market/candles?symbol=AAPL&range=1Y&interval=1d`.

## Stock Scorecard (resumen ejecutivo por acción)

Cada acción muestra en la sidebar una tarjeta compacta **"Stock Scorecard"** que
resume, con datos YA disponibles en la plataforma, qué tan atractiva luce la
acción ahora. **Es análisis informativo heurístico, NO asesoría financiera** y
nunca da órdenes de compra/venta.

- **Propósito**: responder de un vistazo si la acción luce técnicamente fuerte,
  fundamentalmente razonable (con lo que expone Yahoo), si las noticias ayudan o
  perjudican y si el entorno de mercado acompaña; y traducirlo en una **vista
  general** (atractiva ahora / esperar pullback / mixta / riesgosa / datos
  insuficientes…), **riesgo**, **confianza** y un **resumen en español**.
- **Fuentes de datos** (todo ya presente, sin proveedores de pago):
  - *Técnico*: mismas velas diarias (1Y + warmup) de las gráficas → SMA 20/50/200,
    RSI, MACD, Bollinger, volumen y posición frente a soportes/resistencias.
  - *Fundamentales básicos*: `ticker.info` de Yahoo (P/E, márgenes, ROE/ROA,
    crecimiento, deuda/capital, valuación, dividendo…). **No usa ROIC.ai ni
    ningún proveedor de fundamentales de pago.** Si faltan campos, se marcan como
    parciales y baja la confianza.
  - *Noticias*: el módulo de noticias por símbolo ya existente (keywords de
    catalizadores positivos/negativos + frescura).
  - *Sentimiento (proxies, Fase 1)*: tendencia de ^VIX y dirección del S&P 500 si
    están disponibles; si no, `sentimentScore = null` con aviso (se ampliará en
    la Fase 2). Incluye también tu contexto: notas del watchlist y entradas
    simuladas (acotadas por usuario).
- **Puntajes** 0-100: `technicalScore`, `fundamentalScore`, `newsScore`,
  `sentimentScore` y un `overallScore` ponderado (técnico 40 % / fundamental
  30 % / noticias 20 % / sentimiento 10 %; los pesos se **redistribuyen** si falta
  algún componente).
- **Vistas generales** (`overallView`): `ATTRACTIVE_NOW`,
  `INTERESTING_BUT_WAIT_FOR_PULLBACK`, `FUNDAMENTALLY_GOOD_BUT_TECHNICALLY_EXTENDED`,
  `TECHNICALLY_STRONG_BUT_FUNDAMENTALS_MIXED`, `MIXED_REQUIRES_CONFIRMATION`,
  `RISKY_AVOID_FOR_NOW`, `INSUFFICIENT_DATA`.
- **UI compacta**: tarjeta en la sidebar con badge de vista general, riesgo,
  confianza, mini-puntajes y resumen; botones **Ver completo**, **Ver detalles**
  (fortalezas / riesgos / a vigilar / disponibilidad / avisos), **Refrescar**,
  **Explícame con IA** y **Copiar**. No tapa las gráficas.
- **Vista completa VISUAL** (botón "Ver completo"): modal con el **puntaje
  general** arriba (badge de vista/riesgo/confianza + barra de progreso) y una
  fila de cuatro tarjetas (Técnico/Fundamental/Noticias/Sentimiento) con su barra
  de puntaje. En vez de tablas planas, cada métrica se muestra como **tarjeta**
  (`ScoreMetricCard`) agrupada por bloque temático (Tendencia/Momento/Riesgo-
  Recompensa para técnico; Valuación/Rentabilidad/Crecimiento/Balance para
  fundamentales), con **color** (verde/amarillo/rojo/gris), **valor**, **estado**
  (Positivo/Neutral/Negativo/Sin dato), **contribución al puntaje** (ej.
  `9 / 13 pts` con barra) y **fuente** abreviada (Técnico, Yahoo, Noticias,
  Mercado, Dibujos). El backend devuelve esto en `breakdown` por sección; los
  datos faltantes se manejan limpiamente como "Sin dato".
- **Tooltips educativos "?"**: cada sección de puntaje (Técnico/Fundamental/
  Noticias/Sentimiento/General/Riesgo/Confianza) y cada métrica (P/E, RSI, MACD,
  Bollinger, precio vs SMA20/50/200, Canal R/R, ROE, ROA, Deuda/Capital, FCF,
  VIX…) tiene un botón **"?"** (escritorio: hover; móvil: tap) que explica qué
  mide y cómo interpretarlo. Textos en `stockScorecardHelp.ts`; las claves del
  backend se mapean con `scorecardMetricHelpKeyMap.ts`. Los tooltips son
  educativos y **no cambian el cálculo del puntaje**.
- **Configuración de puntuación personalizable** (pestaña *Ajustes* /
  "Configuración de Scorecard"): edita los **pesos** (técnico/fundamental/
  noticias/sentimiento — deben sumar **100**: si no, hay error de validación y un
  botón *Normalizar a 100 %*), los **umbrales técnicos** (RSI ideal/sobrecompra/
  sobreventa, Canal R/R excelente/bueno/mínimo, estructura de medias),
  **fundamentales** (P/E, ROE, ROA, margen, crecimiento, deuda/capital, current
  ratio), **noticias** (antigüedad máxima, premio/castigo por titular) y
  **sentimiento** (umbrales de ^VIX bajo/medio/alto). **Perfiles**: selector de
  perfil activo, *Guardar*, *Guardar como nuevo perfil*, *Fijar como predeterminado*
  y *Restaurar default del sistema*. Cada cambio **recalcula** el scorecard.
  Se guarda por usuario en `dbo.C081` (`GET/POST /api/scorecard/configs`,
  `…/configs/default`, `PATCH /configs/{id}`, `…/set-default`, `POST
  /configs/reset-default`, `DELETE`). El backend **valida** la config (pesos
  numéricos ≥ 0 y total 100, si no `422 INVALID_SCORECARD_CONFIG`); una config
  parcial o corrupta se funde con el default (nunca rompe el cálculo).
- **Integración con IA**: *Explícame con IA* abre el AI Chat del símbolo y
  **precarga** un mensaje en español con los escenarios/riesgos/niveles **y los
  valores reales** de las métricas. El generador de prompts de ChatGPT añade la
  sección *Stock Scorecard* (toggle por defecto on) y un toggle "Métricas
  detalladas" para incluir los valores del breakdown.
- **Backend**: `GET /api/stocks/{symbol}/scorecard` (auth; query opcionales
  `forceRefresh`, `workspaceId`, `focusedChartSlotId`; respuesta con `breakdown`
  y `scoringConfig`). Se calcula on-demand con cache breve en memoria
  (cotización/fundamentales). Datos del usuario (notas/operaciones/config)
  acotados por `C005Id`.
- **Limitaciones**: heurística simple y transparente, no un modelo de valuación
  profesional; los fundamentales y el sentimiento pueden ser parciales; con datos
  insuficientes la vista es `INSUFFICIENT_DATA`. Siempre etiquetado como **no
  asesoría financiera**.

## Estructura

```
trading-analysis-platform/
  backend/      FastAPI + yfinance + pandas + pydantic
  frontend/     React + TypeScript + Vite + Lightweight Charts + Zustand + Tailwind
  docker-compose.yml
```

Cada subproyecto tiene su propio `README.md` con detalles.

## Puesta en marcha (local)

### 0) Requisitos de base de datos (SQL Server)

- **SQL Server** (probado con SQL Server Express, instancia
  `LAPTOP-HIR7OVRK\SQLEXPRESS`) con la base de datos **`AnalisisTecnico`** y
  las tablas existentes `dbo.C005` (usuarios), `dbo.C010` (acciones),
  `dbo.C0101` (dibujos), `dbo.C020` (indicadores), `dbo.C030` (layouts),
  `dbo.C040` (catálogo usuario-acción).
- **ODBC Driver 17 for SQL Server** instalado (lo usa `pyodbc`). Verifica con:

  ```powershell
  Get-OdbcDriver -Name "*SQL Server*" | Select-Object Name
  ```

- La conexión usa **Trusted Connection** (autenticación de Windows): el
  proceso del backend debe correr con un usuario de Windows con acceso a la
  instancia. No se guardan contraseñas de SQL.

### 1) Backend

```bash
cd backend
python -m venv .venv
# Linux/Mac
source .venv/bin/activate
# Windows PowerShell
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

#### 1.1) Configuración `.env`

Copia `backend/.env.example` a `backend/.env` y ajusta los valores. **Nunca**
se hardcodean credenciales ni la URL de la base de datos; todo sale de
variables de entorno:

```ini
DB_SERVER=LAPTOP-HIR7OVRK\SQLEXPRESS
DB_NAME=AnalisisTecnico
DB_DRIVER=ODBC Driver 17 for SQL Server
DB_TRUSTED_CONNECTION=yes
DB_TRUST_CERT=yes

# Genera uno aleatorio, p. ej.: python -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET_KEY=<secreto-aleatorio-largo>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=480

FRONTEND_URL=http://localhost:5174

# SMTP opcional (sin SMTP, en desarrollo el enlace de contraseña
# se imprime en la consola del backend en lugar de enviarse).
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
APP_ENV=development

# OpenAI (AI Chat). Vacío => el chat muestra "IA no disponible" sin romper nada.
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2
OPENAI_TEMPERATURE=0.3
OPENAI_MAX_OUTPUT_TOKENS=1200

# Límites del AI Chat (costo/abuso)
AI_CHAT_MAX_MESSAGES_PER_MINUTE=10
AI_CHAT_MAX_CONTEXT_MESSAGES=20
AI_CHAT_MAX_DRAWINGS_CONTEXT=50
AI_CHAT_MAX_NEWS_ITEMS=5
```

`.env` está en `.gitignore`: no se versiona.

#### 1.2) Migraciones SQL

Los scripts de `backend/sql/` son **idempotentes** (se pueden re-ejecutar):

- `001_auth_fields_and_indexes.sql` — agrega a `C005` las columnas `EsAdmin`,
  `DebeCambiarPassword`, `UltimoAcceso`, `FechaDesactivacion` e índices únicos
  (`NombreNormalizado`, `Email`, ticker+fuente, layout por usuario+acción).
- `002_password_tokens.sql` — crea `dbo.C006` (tokens de contraseña: solo se
  guarda el **hash** del token, nunca el token en claro).
- `004_ai_chat.sql` — crea `dbo.C110` (ChatConversaciones) y `dbo.C111`
  (ChatMensajes) para el AI Chat, con FKs a `C005`/`C010` e índices.
- `009_chart_workspaces.sql` — agrega a `C030` las columnas `C010Id` (nullable,
  retrocompatible con layouts globales) y `Activo` (borrado suave), la FK
  `FK_C030_C010` y el índice `IX_C030_C005Id_C010Id`, para los **workspaces de
  análisis por acción**.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python scripts\run_migrations.py
```

> La app **no** ejecuta `Base.metadata.create_all()` contra SQL Server: las
> tablas ya existen y solo se tocan vía migraciones explícitas.

#### 1.3) Primer administrador (bootstrap por CLI)

No existe registro público; el primer admin se crea por consola:

```powershell
# Windows PowerShell
cd backend
.\.venv\Scripts\Activate.ps1
python scripts\create_admin.py --nombre Admin --email admin@example.com --password "TuPassword123"
```

```bash
# Linux/Mac
cd backend
source .venv/bin/activate
python scripts/create_admin.py --nombre Admin --email admin@example.com --password "TuPassword123"
```

El script es idempotente (avisa si el usuario ya existe) y crea al usuario con
`EsAdmin=1` y `DebeCambiarPassword=0`. **Cambia esa contraseña** después del
primer login (o usa el flujo de reset por correo).

#### 1.4) Arrancar el backend

```bash
uvicorn app.main:app --reload
```

Backend en `http://localhost:8000` (docs en `/docs`). Comprueba la conexión a
SQL con `GET http://localhost:8000/api/health/db` → `{"database":"ok"}`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend SIEMPRE en **`http://localhost:5174`** (puerto fijo con `strictPort`:
si está ocupado, Vite falla en vez de saltar a otro puerto y romper
marcadores). El dev server proxyea `/api` al backend. Opcional:
`npm run dev:redirect` levanta un redirector en `5173 → 5174` para marcadores
antiguos.

### 3) Iniciar sesión

1. Abre `http://localhost:5174` → te redirige a `/login`.
2. Entra con el **usuario o email** y la contraseña del admin creado en 1.3.
3. El token JWT se guarda en `localStorage` y se adjunta como `Bearer` en cada
   request; si expira (401), la app cierra sesión y vuelve a `/login`.
4. Los admins ven el enlace **⚙ Usuarios** en el header (`/admin/users`).

### Flujo de alta de usuario y contraseña por correo

1. Un admin crea el usuario en `/admin/users` con **nombre + email** (sin
   contraseña: "El usuario recibirá un correo para definir su contraseña").
2. El backend genera un token de un solo uso (24 h para alta, 1 h para reset),
   guarda **solo su hash** (HMAC-SHA256) en `dbo.C006` y envía el enlace
   `FRONTEND_URL/set-password?token=...` por correo.
   - **Sin SMTP configurado (desarrollo)**: el enlace se imprime en la consola
     del backend y la UI lo indica ("SMTP no configurado…").
3. El usuario abre el enlace, la página valida el token (muestra el email
   enmascarado) y define su contraseña (mínimo 8 caracteres, con letra y
   número). El token queda usado y `DebeCambiarPassword=0`.
4. "Reset" en `/admin/users` repite el flujo con un token de 1 h y marca al
   usuario para cambio forzado: puede iniciar sesión, pero la app lo lleva a
   `/change-password` hasta que defina la nueva contraseña.

### Recuperación de contraseña desde el login

"¿Olvidaste tu contraseña?" en `/login` lleva a `/forgot-password`: se valida
que el email exista en `C005` (404 si no existe, 403 si el usuario está
inactivo — validación explícita, adecuada para un sistema interno) y se envía
un enlace `/reset-password?token=...` de un solo uso que expira en 1 hora.
Este flujo **nunca crea usuarios**.

### Mi Cuenta y contraseñas temporales

- **Mi Cuenta** (`/account`, enlace 👤 del header, disponible para TODOS los
  usuarios autenticados): ver/editar el propio nombre y email
  (`PATCH /api/auth/me`, con validación de duplicados) y **cambiar la propia
  contraseña** (`POST /api/auth/change-password`, exige la actual). Un usuario
  normal nunca ve la lista de usuarios.
- **Cambio forzado**: si `DebeCambiarPassword=1` el login SÍ funciona, pero la
  app bloquea todas las rutas y redirige a `/change-password` ("Debes cambiar
  tu contraseña temporal antes de continuar") hasta definir una nueva.

### AI Chat (asistente de análisis por ticker)

1. Pega tu clave de OpenAI en `backend/.env` → `OPENAI_API_KEY=sk-...` y
   reinicia el backend. **La clave solo vive en el backend**: el frontend
   jamás la ve, y sin clave el chat muestra un error limpio sin romper la app.
2. Con un ticker activo (p. ej. AAPL), pulsa **✨ AI Chat** en el header: se
   abre un panel lateral acotado a ese símbolo.
3. La IA recibe contexto real de la plataforma según los toggles del panel:
   **Gráfica** (precio canónico + resumen diario 1Y), **Dibujos** (tus líneas
   con sus puntos tiempo/precio), **Indicadores** (configs + SMA/EMA/RSI
   actuales) y **Noticias** (best-effort vía yfinance; si no hay, la IA lo
   dice en lugar de inventar).
4. Las conversaciones se guardan por **usuario + acción** (`C110`/`C111`):
   al volver a AAPL reaparece tu conversación; al cambiar a MSFT ves solo las
   de MSFT. Renombrar (✎) y borrar (🗑, borrado suave) desde la lista 🗂.
5. Límites de seguridad/costo: máx. `AI_CHAT_MAX_MESSAGES_PER_MINUTE`
   mensajes/minuto por usuario (429 al excederlo), historial acotado a
   `AI_CHAT_MAX_CONTEXT_MESSAGES` mensajes y contexto resumido (máx. 50
   dibujos / 5 noticias). El contexto **nunca** incluye `PasswordHash`,
   tokens ni datos de otros usuarios.

> **Las respuestas de la IA son análisis informativo, no asesoría
> financiera.** El asistente habla de escenarios alcistas/bajistas, zonas de
> riesgo e invalidación; nunca da órdenes de compra/venta.

### Modo ChatGPT (iframe/helper) — sin API

Botón **🤖 ChatGPT** en el header (junto a ✨ AI Chat). Diferencias clave:

| | ✨ AI Chat | 🤖 ChatGPT |
| --- | --- | --- |
| Motor | API de OpenAI (backend) | Tu sesión de ChatGPT en el navegador |
| Historial | Guardado en SQL (`C110`/`C111`) | Solo en tu cuenta de ChatGPT |
| Costo | Consume tu crédito de API | Tu plan de ChatGPT |

Flujo: el panel genera un **prompt** con el contexto real del ticker
(`GET /api/chatgpt/context` — autenticado, no llama a OpenAI ni escribe en
SQL): precio, indicadores actuales, tus dibujos, favorito/tags/notas del
watchlist y temporalidades. Eliges el tipo de prompt (análisis técnico,
escenarios, riesgo, soportes/resistencias, revisión de dibujos…), ajustas los
toggles y pulsas "**Copiar prompt y abrir ChatGPT en pestaña nueva**": copia
el prompt y abre tu sesión de ChatGPT; ahí lo pegas (Ctrl+V).

> **Por qué no hay iframe**: chatgpt.com rechaza cargarse dentro de otras
> páginas (X-Frame-Options/CSP de OpenAI). No es un fallo de la plataforma y
> no se puede saltar. Por eso el panel muestra la guía del flujo en lugar de
> un iframe roto; `VITE_ENABLE_CHATGPT_IFRAME=true` reactiva el intento de
> iframe solo si configuras una URL que sí permita embebido.

La app jamás lee, controla ni guarda lo que pasa dentro de ChatGPT.

Variables del frontend (`frontend/.env.local`, opcionales):

```ini
VITE_CHATGPT_IFRAME_URL=https://chatgpt.com/
VITE_ENABLE_CHATGPT_IFRAME=false
VITE_CHATGPT_IFRAME_FALLBACK_NEW_TAB=true
```

### Noticias y Market Movers

- **📰 Noticias** (`/news`): titulares globales de mercado/geopolítica (Fed,
  inflación, tecnología, IA, semiconductores, energía…) con filtros por
  categoría (clasificación por palabras clave en el backend), fuente, hora y
  link externo. **Panel compacto por ticker** en el sidebar ("Noticias AAPL")
  que se carga sin bloquear las gráficas. Los titulares también alimentan el
  contexto del AI Chat y el prompt de ChatGPT (máx. 5, sin inventar noticias).
- **Relevancia ESTRICTA por símbolo**: el panel del ticker solo muestra
  noticias realmente relacionadas con el instrumento activo. Las consultas se
  construyen con la metadata de `C010` (nombre de empresa primero, ticker
  después) y cada titular pasa por un score de relevancia con filtros de
  falsos positivos: para **OPEN** solo cuenta Opendoor/`OPEN stock` (jamás
  "SpaceX open IPO" ni "market open"); para **AI** solo C3.ai; para **ON**
  solo ON Semiconductor. Tickers ambiguos exigen un umbral más alto, los
  vínculos `C061` solo se crean si pasan el umbral, y si nada es relevante el
  panel lo dice claramente en lugar de rellenar con basura. `NEWS_DEBUG=true`
  loguea consultas, scores y razones de rechazo.
- **Globales más amplias y rankeadas**: grupos de consultas intercalados
  (mercado, geopolítica/política, macro/Fed, sectores, trending; hasta 30
  consultas por refresh) y ranking en lectura por frescura + calidad de la
  fuente (Reuters/Bloomberg/CNBC/WSJ…) + keywords de impacto de mercado — un
  dashboard de mercado, no una búsqueda web genérica.
- **🚀 Market Movers** (`/market-movers`): Tendencia, Mayores subidas,
  Mayores caídas y Más activas (screeners de Yahoo), con precio/cambio %/
  volumen/market cap; clic en el ticker abre las gráficas y `＋☆` lo agrega
  al watchlist.
- **Arquitectura**: el frontend JAMÁS llama a proveedores externos — el
  backend consulta providers detrás de una interfaz común
  (`YahooNewsProvider`, `GoogleNewsProvider` vía RSS; fácil agregar
  NewsAPI/GNews/Finnhub después) y **cachea en SQL** (`C060`-`C063`) con TTL
  corto (noticias por ticker 5 min, globales 10 min, movers 5 min;
  configurables). `forceRefresh=true` ignora el TTL. Si un proveedor falla,
  se sirve el cache con un aviso — nunca se pierde lo que ya había.
- Limpieza: `NoticiasRepository.cleanup_old_news` (30 días) y
  `MarketMoversRepository.cleanup_old_snapshots` (7 días).

Variables opcionales del backend (`.env`):

```ini
ENABLE_YAHOO_NEWS_PROVIDER=true
ENABLE_GOOGLE_NEWS_PROVIDER=true
GOOGLE_NEWS_REGION=US
GOOGLE_NEWS_LANGUAGE=en
GOOGLE_NEWS_TIMEOUT_SECONDS=10
NEWS_SYMBOL_TTL_MINUTES=5
NEWS_GLOBAL_TTL_MINUTES=10
MARKET_MOVERS_TTL_MINUTES=5
NEWS_MAX_ITEMS_PER_PROVIDER=50
NEWS_CLEANUP_DAYS=30
MARKET_MOVERS_CLEANUP_DAYS=7
```

> Los proveedores externos son best-effort y están aislados: pueden fallar o
> devolver vacío ocasionalmente sin romper la app.

**Mejoras de robustez**: las noticias globales agregan SEIS fuentes (Yahoo
Finance Latest/Top/Trending vía RSS + Google News con grupos de consultas de
mercado, geopolítica/política y acciones en movimiento). La categoría
**Geopolitics / Policy** ahora captura titulares políticos que mueven mercado
(Trump, tarifas, trade deals, shutdown, sanciones, regulación…). La sección
**🔥 Top Trending Stocks Today** en `/news` muestra qué acciones se mueven hoy
y por qué (endpoint propio con TTL de 5 min y badges de tickers conocidos que
abren la gráfica). Filtro por fuente (Todas/Yahoo/Google) y dedupe por URL
normalizada (sin parámetros de tracking).

### Inteligencia de Mercado y sentimiento (Fase 2)

Página **🧠 Inteligencia** (`/market-intelligence`, para todos los usuarios
autenticados) para entender el entorno de mercado **antes** de analizar una
acción. No reemplaza el dashboard ni las gráficas.

- **Índices principales**: S&P 500, NASDAQ, Dow, Russell 2000, VIX, FTSE 100,
  DAX y Nikkei 225 — tarjetas con precio, cambio %, tendencia y mini-sparkline.
  Todo via backend (`GET /api/market-intelligence/overview`); el frontend nunca
  llama a Yahoo directo. Si un índice no está disponible, se muestra un estado
  limpio (sin datos falsos).
- **Sentimiento / Fear & Greed (proxy)**: gauge gradiente miedo→codicia con
  puntaje 0-100, etiqueta (Miedo extremo / Miedo / Neutral / Codicia / Codicia
  extrema), confianza, fuente y **desglose por componente** (VIX, S&P 500,
  NASDAQ, Russell 2000, breadth de movers, tono de noticias). Es un **proxy
  interno** (NO el índice oficial de CNN) y **no debe usarse como señal única de
  compra/venta**. Pesos: VIX 30 % · S&P 25 % · NASDAQ 15 % · Russell 10 % ·
  breadth 10 % · noticias 10 %; si falta un componente, se **redistribuye** el
  peso y baja la confianza. Arquitectura de proveedores (`services/sentiment/`)
  para enchufar un proveedor externo en el futuro.
- **Resumen de market movers y de noticias**: reutilizan los módulos existentes
  (C062/C063 y C060/C061) y enlazan a `/market-movers` y `/news`.
- **Qué significa esto**: 3-5 bullets en español basados en reglas (sin llamada
  a IA en cada carga) que traducen el entorno; botón **✨ Preguntar a la IA**
  que abre el AI Chat con el contexto de mercado.
- **Integraciones**: el **Stock Scorecard** reporta `sentimentSource` y comparte
  los umbrales de ^VIX; el **AI Chat** y el **prompt de ChatGPT** (toggle
  *Inteligencia de Mercado* + tipo *Contexto de mercado + acción*) incluyen el
  sentimiento, los índices, los movers y los titulares cuando están disponibles.
  La IA usa lenguaje de escenarios, nunca señales garantizadas.
- **Cache y robustez** (`dbo.C080`, cache COMPARTIDO con TTL): se sirve cache
  salvo `forceRefresh=true`; si un proveedor falla y hay cache, se devuelve el
  cache con aviso; si falla y no hay cache, respuesta **parcial con warnings**.
  Nunca tumba la página ni guarda datos de usuario. Variables de entorno:
  `ENABLE_MARKET_INTELLIGENCE`, `ENABLE_MARKET_SENTIMENT`,
  `MARKET_INTELLIGENCE_TTL_MINUTES`, `MARKET_SENTIMENT_TTL_MINUTES`,
  `MARKET_INTELLIGENCE_DEBUG`.

### Macro Dashboard (Fase 3)

Página **🌐 Macro** (`/macro`, para todos los usuarios autenticados) con el
entorno macroeconómico que afecta a acciones, sectores, tasas y apetito de
riesgo. No reemplaza Inteligencia de Mercado; es un módulo aparte e informativo.

- **Resumen de riesgo macro**: badge GREEN/YELLOW/RED/UNKNOWN con score, factores
  y riesgos, calculado por reglas a partir de inflación, nivel de tasas, empleo,
  PIB, curva de rendimientos y el sentimiento/VIX de la Fase 2.
- **Tooltips de ayuda**: cada tarjeta tiene un botón **"?"** (escritorio: hover;
  móvil: tap) que explica qué mide el indicador, por qué importa y cómo
  interpretar valores altos/bajos. Textos centralizados en `macroIndicatorHelp.ts`.
- **Indicadores de EE.UU.** (Fed Funds, CPI, PCE, desempleo, nóminas, PIB, ISM,
  confianza): vía **`FRED_API_KEY`**. Sin clave se muestran como *Unavailable*
  con un aviso limpio — la página **no falla**.
- **Producción industrial (INDPRO) y Ventas minoristas (RSAFS)**: reemplazan a
  los ISM PMI (descontinuados gratis en FRED y por eso poco fiables). Producción
  industrial es un proxy de la actividad/output industrial real; ventas
  minoristas es un proxy del consumo. Series **configurables** vía
  `FRED_SERIES_INDUSTRIAL_PRODUCTION` / `FRED_SERIES_RETAIL_SALES`; tendencia por
  última lectura vs previa (y % de cambio en ventas minoristas).
- **Tasas y curva de rendimientos**: Tesoro 2/5/10/30 años (5/10/30 vía Yahoo;
  2 años vía FRED) con estado de la curva (Normal / Plana / Invertida / Sin
  datos) y mini-gráfico de la curva.
- **Mercados globales**: FX (EUR/USD, GBP/USD, USD/JPY, USD/CHF, **USD/MXN**),
  materias primas (oro, plata, WTI, Brent, gas) y cripto (BTC, ETH, BNB, SOL, XRP)
  vía Yahoo Finance (el frontend nunca llama a Yahoo directo).
- **Calendario económico (FRED)**: con `FRED_API_KEY` se arma con las **fechas de
  publicación** de FRED (`release/dates`) para los releases clave (CPI, NFP, GDP,
  PCE, FOMC, ventas minoristas, sentimiento del consumidor); los release IDs se
  resuelven por keyword y se cachean en C080. Incluye una nota de que las fechas
  de FRED las publican las fuentes y pueden no coincidir con la disponibilidad
  exacta del dato. **Nunca inventa fechas**; si no hay datos útiles, la sección se
  **oculta** (no se muestra un panel grande vacío) y el aviso aparece en las
  advertencias de la página.
- **Qué significa esto para inversionistas**: 3-6 bullets en español por reglas
  (sin IA en cada carga) + botón **✨ Preguntar a la IA**.
- **Integraciones**: el **Stock Scorecard** incluye `macroContext` (riesgo, curva,
  inflación) y un *watch item* cuando el riesgo macro es moderado/elevado; el
  **AI Chat** y el **prompt de ChatGPT** (toggle *Macro* + tipo *Macro + mercado
  + decisión*) usan el contexto macro cuando está disponible; la página de
  Inteligencia muestra una tarjeta compacta de riesgo macro. La IA usa lenguaje
  de escenarios, nunca predicciones garantizadas.
- **Cache y robustez** (`dbo.C080`, compartido con Fase 2; TTL
  `MACRO_CACHE_TTL_MINUTES`): se sirve cache salvo `forceRefresh=true`; si un
  proveedor falla y hay cache, se devuelve el cache con aviso; si falla y no hay
  cache, respuesta **parcial con warnings**. Aclaraciones:
  - Los indicadores de EE.UU. y el calendario usan FRED; Yahoo aporta los proxies
    de mercado (tasas largas, FX, commodities, cripto).
  - Si faltan proveedores o series, el resultado son **datos parciales con avisos
    específicos, no un fallo** — y los paneles sin datos útiles se ocultan.
  - El Macro Dashboard es informativo, **no es una señal de trading**.
- **Variables de entorno**: `ENABLE_MACRO_DASHBOARD`, `MACRO_CACHE_TTL_MINUTES`,
  `MACRO_DEBUG`, `FRED_API_KEY`, `FRED_API_BASE_URL`,
  `FRED_SERIES_INDUSTRIAL_PRODUCTION` (INDPRO), `FRED_SERIES_RETAIL_SALES` (RSAFS),
  `ECONOMIC_CALENDAR_PROVIDER`, `ECONOMIC_CALENDAR_API_KEY`,
  `ECONOMIC_CALENDAR_TTL_MINUTES`. La tabla `C080` cachea inteligencia de mercado,
  sentimiento, datos macro y el mapeo de release IDs de FRED.

### Portfolio Analysis (Fase 4)

Página **💼 Portafolio** (`/portfolio`, para todos los usuarios autenticados):
crea portafolios, agrega posiciones y analiza valor, ganancia/pérdida,
asignación, concentración y comparación con el mercado. Es un módulo **separado
del watchlist** (el watchlist son acciones que sigues; el portafolio son
tenencias con cantidad y costo). Informativo, **no es asesoría financiera**.

- **Portafolios y posiciones** (`dbo.C090`/`dbo.C091`, acotados por usuario):
  crea/edita/elimina (borrado suave) portafolios, fija uno como predeterminado y
  agrega/edita/elimina posiciones (ticker, cantidad, costo promedio, fecha,
  notas). Al agregar una posición el backend enriquece el instrumento con Yahoo
  (nombre, sector, industria, moneda) — best-effort, nunca falla.
- **Resumen**: costo total, valor actual, P/L $ y %, número de posiciones, mejor
  y peor posición. Cada posición muestra precio actual (cotización canónica),
  valor, P/L y peso; si falta la cotización, se marca con aviso.
- **Asignación**: por posición, sector, tipo de activo y moneda (barras), con
  alertas de concentración (posición > 20%, sector > 40%, top 3 > 60%).
- **Riesgo**: nivel (Conservador/Moderado/Agresivo/Alta concentración/Sin datos)
  + concentración (mayor posición, top 3, mayor sector). Las métricas avanzadas
  (beta, volatilidad, Sharpe, drawdown) se muestran como no disponibles hasta
  tener histórico — **no se inventan valores**.
- **Comparación vs S&P 500** (`^GSPC`): usa la fecha de compra más antigua como
  aproximación (claramente etiquetado); si no hay fechas, estado limpio "no
  disponible".
- **Recomendaciones por reglas**: concentración, sector, diversificación, moneda,
  ganadores/perdedores, con lenguaje de *revisar/confirmar/monitorear* (nunca
  órdenes de compra/venta).
- **Resumen con IA** (botón, bajo demanda): envía el contexto del portafolio al
  servicio de IA y devuelve un resumen en español; sin `OPENAI_API_KEY` muestra
  "Resumen de IA no disponible" limpio. El **AI Chat** y el **prompt de ChatGPT**
  (toggle *Portafolio* + tipo *Análisis de portafolio*) también usan el contexto
  del portafolio. Nunca da asesoría garantizada.
- **Export CSV** de las posiciones. Cada usuario solo ve/edita sus propios
  portafolios y posiciones (acotado por `C005Id`); el hard-delete de usuario
  elimina también C090/C091.

### Dibujos editables y canal auto-detectado

- **Mover/ajustar líneas**: con el **Cursor**, selecciona una línea y
  arrástrala completa (conserva la pendiente) o arrastra una de sus manijas
  para cambiar el extremo/pendiente. Se guarda en SQL al soltar y se refleja
  en las seis gráficas; Escape cancela; los dibujos **bloqueados** no se
  mueven (HTTP 423).
- **Canal R/R automático**: el sistema detecta solo los pares de líneas
  ~paralelas (Free Line/trendline), decide cuál es superior/inferior por
  precio, valida ancho y que el precio esté dentro, y muestra el ratio en un
  **badge en cada gráfica** ("Canal R/R 2.68 : 1") y en el panel lateral con
  su confianza. La selección manual queda como respaldo colapsado. El
  resultado (con confianza) viaja a los prompts de IA. Hipotético, no
  asesoría financiera.

### Refresh manual y auto-refresh

- **⟳ Refresh** (header): recarga el ticker activo con datos frescos de Yahoo
  (`forceRefresh=true` ignora el cache del backend): las seis temporalidades,
  la cotización canónica, los indicadores y el rendimiento de las entradas
  simuladas. **No destructivo**: las gráficas siguen visibles mientras carga,
  los dibujos/zoom/paneles se conservan y, si una temporalidad falla, se
  mantienen sus velas anteriores.
- **⏱ Auto refresh** (menú): intervalos de **5 / 10 / 15 / 20 min** con
  comportamiento de radio (solo uno activo; re-clic en el activo lo apaga;
  ninguno = Off). La preferencia persiste en localStorage
  (`tradingPlatform.autoRefreshIntervalMinutes`). Mínimo 5 min para no
  saturar Yahoo; con la pestaña oculta los ticks se saltan y al volver se
  refresca una vez solo si ya pasó el intervalo. El menú muestra la hora del
  último refresh.

### Entradas simuladas (paper trading) y R/R de canal

- **Entradas simuladas** (`dbo.C050`, panel "Entradas simuladas" del sidebar):
  marca *"hipotéticamente entré aquí"* con precio/tipo (LONG/SHORT)/cantidad/
  notas/color. **Marcador EXACTO en la gráfica**: además de la línea punteada al
  precio (ahora secundaria), se dibuja una **flecha anclada al tiempo + precio de
  entrada** (▲ verde abajo para LONG, ▼ roja arriba para SHORT, con etiqueta
  tipo+precio) sobre el bar real más cercano de cada temporalidad. Persisten en
  SQL y el panel muestra P/L no realizado (%, monto y días desde la entrada) con
  el precio canónico actual. Acciones: **📍 Localizar** (asegura el marcador
  visible en las gráficas), **🔍 Análisis** (abre el detalle con el snapshot),
  cerrar (P/L realizado con precio de salida), ocultar/mostrar, eliminar (borrado
  suave `Activo=0`). Quitar el ticker del watchlist NO borra las entradas.
- **Snapshot de análisis al crear** (workspace + contexto): cada entrada guarda
  su **workspace** (`C050.C030Id`, nullable — las entradas se cargan/filtran por
  workspace activo, como los dibujos), el **MetadataJSON** (contexto de gráfica/
  workspace/momento) y el **AnalisisJSON** (subconjunto del scorecard, valores
  técnicos reales, R/R de canal y la **tesis**: tesis de entrada, escenario
  alcista/bajista, nivel de invalidación, zona objetivo). El modal de creación
  muestra una **vista previa** del scorecard/Canal R/R y una sección opcional
  *Tesis y escenarios*; el botón guarda como *"Guardar entrada con análisis"*. El
  **detalle** (modal *Análisis*) muestra el snapshot original y lo **compara con
  el estado actual** (puntajes y precio/rendimiento). Endpoints: `GET
  /api/simulated-trades/{id}` (detalle con snapshot), `?c030Id=` en el listado,
  y `PATCH` de la tesis que **no pisa** el resto del snapshot. Todo acotado por
  `C005Id`: ningún usuario ve ni edita las entradas de otro.
- **R/R de canal** (panel "R/R de canal"): selecciona DOS Free Lines como
  canal superior/inferior (con intercambio automático/manual) y una referencia
  (precio actual o entrada simulada); calcula beneficio/riesgo potencial y el
  ratio (p. ej. `2.68 : 1`) por interpolación/extrapolación lineal de tus
  líneas (tiempos en ms). Botón para copiar el resumen.
- **Integración con IA**: el AI Chat y el generador de prompts de ChatGPT
  incluyen automáticamente tus entradas simuladas y el último R/R de canal
  calculado. Todo es **análisis hipotético, no asesoría financiera**.

### Watchlist: quitar con confirmación y favoritos reales

- **Quitar un ticker** pide confirmación y solo desactiva TU fila de `C040`
  (`Activo=0`). **Nunca** borra la acción maestra (`C010`) ni tus dibujos,
  indicadores, layouts o chats de IA.
- **La estrella ★ es `C040.Favorito` real**: persiste tras refrescar, ordena
  los favoritos primero (`Favorito DESC, UltimaConsulta DESC, Ticker ASC`) y
  hay filtro "Solo favoritos" en el sidebar. Endpoint dedicado:
  `PATCH /api/catalog/{c010Id}/favorite`.

### Acciones de administración de usuarios

En `/admin/users` (solo admins): Editar · Reset (correo; usuario activo) ·
**Clave temp.** (contraseña temporal con confirmación y checkbox "exigir
cambio en el siguiente login", activado por defecto; nunca por correo) ·
**Forzar cambio** (solo marca el flag) · Desactivar/Activar (reversible,
conserva datos) · **Eliminar definitivamente** (usuarios de prueba: borra
tokens, dibujos, indicadores, layouts y catálogo y luego el usuario, en una
sola transacción; requiere teclear `DELETE`; bloqueado para uno mismo y para
el último admin activo).

### Con Docker (opcional)

```bash
docker compose up --build
```

> El modo Docker no incluye SQL Server; está pensado para la pila
> backend+frontend. Con base de datos usa la puesta en marcha local.

## Pruebas

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

Las pruebas cubren: timeframes (front y back), normalización OHLCV, repositorios
locales, indicadores, **proyección de líneas**, visibilidad/filtros globales de
dibujos, colores por temporalidad, migración `4Y_1D→4Y_1W` e integración de
dibujo (pointer → guardar → render en jsdom). Además: **autenticación** (login
por usuario/email, bloqueo de inactivos y de `DebeCambiarPassword`, ciclo de
vida de tokens de contraseña, reglas de admin incluido el "último admin
activo", **aislamiento por usuario** de dibujos/catálogo/layout/indicadores) en
backend, y guards de rutas, Bearer token, logout en 401 y página
set-password en frontend.

> Las pruebas del backend usan **SQLite en memoria** (no tocan SQL Server) y
> las del frontend usan repositorios `localStorage` (modo test), sin red.

## Criterios de aceptación cubiertos

- Backend y frontend ejecutables localmente.
- Buscar `AAPL` lo agrega al catálogo y carga sus seis gráficas (el 4Y es semanal).
- Cambio de tipo de gráfica (velas/barras/línea/área/volumen).
- Dibujar una línea libre; persiste por ticker y tras refrescar el navegador.
- **El dibujo aparece en las seis gráficas** (proyectado), no solo donde se creó.
- Filtros globales por temporalidad (mostrar/ocultar) + color por temporalidad.
- Indicadores globales (SMA/EMA/Volumen) en las seis gráficas, calculados por panel.
- Fallo parcial: una gráfica con error no rompe el resto.

## Decisiones de diseño relevantes

- **Adaptador de motor de gráficas** (`ChartEngineAdapter`): aísla la app de
  Lightweight Charts para poder migrar en el futuro (p. ej. a TradingView
  Advanced Charts) sin reescribir las features.
- **Dibujos en coordenadas de mercado**: cada punto se guarda como
  `{ time (ms UTC), price }`. Así un dibujo hecho en `4Y_1W` se **proyecta** a
  cualquier otra temporalidad (`projectLineToVisibleRange`). La capa de render
  (`DrawingLayer`, overlay SVG) convierte a píxeles **solo al pintar**. Hoy se
  persisten en SQL Server (`dbo.C0101`) por usuario y ticker; sobreviven a
  refrescos de página y a cambios de navegador/equipo.
- **Repositorios**: la persistencia está detrás de interfaces
  (`DrawingRepository`, `SymbolCatalogRepository`, `LayoutRepository`). En
  ejecución normal se usan los repositorios **Api*** (SQL vía backend); en
  modo test (`import.meta.env.MODE === "test"`) se usan los `LocalStorage*`
  para que las pruebas jsdom no requieran red.
- **Timeframes centralizados** en front (`utils/timeframes.ts`) y back
  (`app/timeframes.py`) para no duplicar lógica.
- **Backend normaliza** todo: el frontend nunca ve DataFrames; recibe velas con
  tiempo en Unix ms UTC.

## Base de datos y autenticación (arquitectura)

Persistencia real en SQL Server `AnalisisTecnico` (SQLAlchemy + pyodbc,
Trusted Connection, URL construida con `quote_plus` por la barra invertida de
la instancia). Tablas:

| Tabla | Contenido | Notas |
| --- | --- | --- |
| `dbo.C005` | Usuarios | `PasswordHash` bcrypt, **nunca** se expone por API. `NombreNormalizado` es **columna computada persistida** `UPPER(TRIM(...))` (no se escribe; las búsquedas normalizan a mayúsculas). |
| `dbo.C006` | Tokens de contraseña | **Solo `TokenHash`** (HMAC-SHA256). Un solo uso, expiran (alta 24 h / reset 1 h). Única tabla con IDENTITY. |
| `dbo.C010` | Acciones (tickers) | `TickerNormalizado` computada. Se auto-registra el ticker al guardar el primer dibujo. |
| `dbo.C0101` | Dibujos | Por usuario y acción. **Borrado suave** (`Eliminado=1`). Puntos/estilo como JSON (time en ms + price). |
| `dbo.C020` | Config. de indicadores | `C010Id NULL` = configuración global del usuario. |
| `dbo.C030` | Layouts / **workspaces** | Layout global heredado (`C010Id NULL`) **y** workspaces de análisis por usuario + acción (`C010Id` fijo, `Activo` para borrado suave). Cada fila = un workspace con seis slots en `ConfiguracionJSON`. |
| `dbo.C040` | Catálogo usuario-acción | Watchlist con favoritos/tags; quitar = `Activo=0`. |

Las tablas originales **no tienen IDENTITY**: los IDs se asignan con
`MAX(id)+1` dentro de la transacción (`app/repositories/sql_utils.py`).

Reglas de seguridad implementadas:

- Sin registro público; usuarios creados solo por admins.
- JWT firmado con `JWT_SECRET_KEY` (de entorno); `sub` = `C005Id`.
- **Todos** los endpoints de la app exigen Bearer (incluido `/api/market/*`).
  Públicos solo: `/api/health`, `/api/health/db`, `/api/auth/login`,
  `/api/auth/validate-password-token`, `/api/auth/set-password`.
- Cada usuario solo ve **sus** dibujos/catálogo/layouts/indicadores
  (filtrado por `C005Id` en cada repositorio).
- No se puede desactivar ni quitar permisos al **último admin activo**.
- Usuarios y dibujos se borran en **suave** (nunca DELETE físico).
- Los tokens de contraseña jamás se guardan ni loguean en claro en
  producción; el enlace con el token solo viaja en el correo.

## Comportamiento conocido (Known behavior)

- **Las velas son por temporalidad.** Cada uno de los seis paneles descarga su
  propio OHLCV (semanal, diario, 1h o 30m) con precios **crudos**
  (`auto_adjust=False`, nunca `Adj Close`). El backend lo declara con
  `priceBasis: "raw"`. El 4Y es **semanal** (`4Y_1W`, `interval=1wk`). Es normal
  que el ultimo candle tenga distinta marca de tiempo entre temporalidades.
- **El precio actual mostrado es canonico, idéntico en las seis gráficas.** El
  "precio del ticker" del header, del panel, del item activo de la watchlist y
  **la línea/etiqueta de precio del eje derecho** provienen de UNA sola fuente:
  `GET /api/market/quote` (`quote.price`). En cada gráfica se desactiva el
  último-valor por defecto de Lightweight Charts (`lastValueVisible:false`,
  `priceLineVisible:false`) y se pinta **una línea de precio canónica** punteada
  con SOLO el precio en la etiqueta (sin la palabra "Last"). Su color depende
  del cambio diario de la cotización: **verde** si sube, **rojo** si baja, gris
  neutro si es 0 o no está disponible. Si la cotización no está disponible, cae
  al último close de la preset de mayor resolución disponible (una sola vez, a
  nivel de símbolo): `1W_30M → 1M_1H → 3M_1D → 6M_1D → 1Y_1D → 4Y_1W`. El OHLC
  bajo el crosshair de cada candle sí puede diferir por temporalidad.
- **Se puede dibujar "al futuro", más allá del último candle.** Cada gráfica
  anexa puntos de WHITESPACE (solo `{ time }`, sin OHLC falso) después del
  último bar real (`futureWhitespace.ts`: 52 semanas en 4Y, 90/60/45 días,
  80 horas, 80 medias horas). Eso habilita clicks y coordenadas en el área
  futura sin crear velas falsas ni afectar los indicadores. Como respaldo,
  más allá del whitespace se estima el tiempo con `coordinateToLogical` + el
  paso del preset (solo hacia adelante).
- **Los dibujos son globales y se guardan en coordenadas de mercado (time +
  price), nunca en pixeles.** Se persisten por usuario y ticker via
  `DrawingRepository` (SQL Server a través de la API). Un dibujo es elegible en **las seis gráficas**. La "Línea
  libre" es un **segmento FINITO**: se **recorta** (`clipFreeLineSegmentToVisibleRange`)
  al rango visible de cada panel y nunca se extiende más allá de los dos puntos
  elegidos; si el segmento no cae en la ventana de un chart, no se dibuja ahí.
  Para que un dibujo creado en una temporalidad se vea ALINEADO en las demás,
  la conversión tiempo→pixel es **robusta** (`timeMsToCoordinateRobust`):
  primero la conversión nativa y, si el timestamp no existe en la escala del
  chart destino (p. ej. un punto diario sobre la escala semanal de 4Y_1W),
  **interpola entre las coordenadas reales de las velas vecinas** (y, para
  tiempos futuros, sobre el grid de whitespace). Nunca se interpola sobre el
  ancho del contenedor: las velas se espacian por índice (los fines de semana
  no ocupan espacio) y el rango visible incluye whitespace futuro, así que esa
  aproximación desalineaba los dibujos hacia el área vacía. Solo para pintar
  dibujos, sin velas falsas ni cambios en lo guardado. Los puntos antiguos
  guardados en segundos se normalizan a milisegundos al cargar.
  Su `sourceTimeframe` controla su etiqueta, su color por defecto y si los
  filtros globales lo muestran. La antigua "vista Resumen" se eliminó: el
  dashboard de seis gráficas es el único espacio de trabajo.
- **Herramientas de dibujo** (todas de dos puntos, almacenadas como
  time+price, globales a las seis gráficas, filtrables y borrables):
  - **Línea libre** (／): segmento finito sólido.
  - **Trendline extendida** (↗): recta PROYECTADA a todo el rango visible
    (incluido el whitespace futuro). `extendLeft/Right = true`.
  - **Línea punteada** (┄): segmento finito punteado (soportes/resistencias).
  - **Zona / rectángulo** (▭) y **Elipse** (◯): formas semitransparentes
    (`fillOpacity` 0.12 / 0.10) que no tapan las velas.
  - **Goma** (icono de borrador): funciona como una goma real — mantén
    presionado y **arrastra** sobre los dibujos; todo dibujo tocado por el
    trazo se borra (uno a la vez, el superior si hay solapados, sin repetir en
    el mismo trazo). Radio de borrado **6 px** con un círculo-cursor visible
    (preciso: no borra líneas vecinas por accidente).
  - Los dibujos legados tipo `trendline` se migran automáticamente a
    `free_line` (si no estaban extendidos) o `extended_trendline` (si lo
    estaban); versión de modelo: 3.
- **Filtros de dibujo**: cada pill de temporalidad tiene punto de color (click
  = color picker), cuerpo (click = mostrar/ocultar, NO destructivo) y una ✕
  sutil (hover rojo) que borra los dibujos de esa temporalidad **con
  confirmación**.
- **Migración automática.** Los dibujos antiguos con `sourceTimeframe: "4Y_1D"`
  se migran a `"4Y_1W"` al cargarse (también dentro de `showOnTimeframes`), y se
  les añade `showOnAllTimeframes`/`usesTimeframeDefaultColor` si faltan. No se
  pierde ningún dibujo.
- **Herramienta de dibujo actual: "Línea libre" (free line).** Se dibuja sobre
  un **overlay SVG** (`z-index` por encima del canvas, `pointer-events` solo
  activos al dibujar) usando las APIs de Lightweight Charts
  (`coordinateToTime`/`coordinateToPrice`). Flujo: click A → mover (preview con
  línea punteada) → click B. Se guarda sola y permanece activa para encadenar
  otra. `Esc`/click derecho cancela el trazo; con el **Cursor** seleccionas una
  línea (se resalta con manijas) y la borras con `Supr` o el botón 🗑. La barra
  de dibujo es: **Cursor · Línea libre · 🗑 Eliminar seleccionado · ⊘ Borrar del
  ticker**. Los demás tipos (`horizontal`, `ray`, `rectangle`…) existen en el
  modelo pero aún no tienen herramienta. En desarrollo, al activar Línea libre
  se muestra un pequeño panel de diagnóstico (estado, refs, último punto).

## Redes corporativas con proxy TLS (MITM)

Si tu red intercepta TLS (común en empresas), verás dos síntomas:

1. `npm install` falla/cuelga con `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
   - Solución aplicada: `npm config set strict-ssl false` (o configurar el root CA
     corporativo en npm). Tras esto, `npm install` funciona.
2. yfinance falla con `curl (60) SSL certificate problem: unable to get local
   issuer certificate` y las gráficas quedan "Sin datos".
   - Solución aplicada: el backend, en Windows, **genera automáticamente** un CA
     bundle combinando `certifi` + el almacén de certificados del sistema
     (`backend/app/ca_bundle.py`, ejecutado al arrancar) y exporta
     `CURL_CA_BUNDLE`/`SSL_CERT_FILE`/`REQUESTS_CA_BUNDLE`. No requiere acción
     manual. También puedes generarlo a mano con
     `python backend/scripts/export_win_ca.py`.

> Nota: si los puertos 8000 o 5173 están ocupados, el backend/Vite usarán otro
> puerto. Vite imprime la URL real (`Local: http://localhost:5174/`). El destino
> del proxy de Vite es configurable con `VITE_API_PROXY_TARGET` en un
> `frontend/.env.local`.

## Limitaciones conocidas

- `yfinance` puede aplicar rate limiting; hay cache en memoria con TTL.
- La búsqueda valida el ticker exacto (no es búsqueda difusa).
- El token JWT se guarda en `localStorage` (suficiente para el MVP personal;
  para multiusuario expuesto considerar cookies httpOnly).
- Sin SMTP configurado, los enlaces de contraseña solo se imprimen en la
  consola del backend (modo desarrollo).
