# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal TradingView-like technical analysis platform (UI text in Spanish). The project lives in
`trading-analysis-platform/` with two independent apps:

- `backend/` — Python FastAPI + yfinance + pandas + **SQLAlchemy 2.0 + pyodbc → SQL Server**
  (`AnalisisTecnico` on `LAPTOP-HIR7OVRK\SQLEXPRESS`, Windows Trusted Connection). JWT auth; all user
  data (drawings/catalog/layouts/indicators/users) lives in SQL.
- `frontend/` — React + TypeScript (strict) + Vite + **Lightweight Charts v4** + Zustand + TailwindCSS
  + react-router-dom v7. Persistence goes through repository interfaces: **Api\* repos (SQL via
  backend)** in normal runs, LocalStorage\* repos only in test mode and for the auth token/UI prefs.

The frontend never calls Yahoo directly; all market data goes through the backend.

## Commands

Backend (from `trading-analysis-platform/backend/`):

```bash
pip install -r requirements.txt
python scripts/run_migrations.py               # idempotent; applies sql/*.sql to the real DB
python scripts/create_admin.py --nombre X --email x@y.com --password "Pass1234"  # bootstrap admin
python -m uvicorn app.main:app --reload        # http://localhost:8000 (docs at /docs)
pytest                                          # all tests (yfinance mocked, SQLite in-memory; no network/SQL Server)
pytest app/tests/test_market.py -k warmup       # single test by keyword
```

Backend needs `backend/.env` (gitignored; template in `.env.example`): DB_* vars, `JWT_SECRET_KEY`,
`FRONTEND_URL`, optional SMTP_*. Config lives in `app/config.py` (`AppEnvSettings`, no prefix) which
builds `database_url` with `quote_plus` (instance name has a backslash). Never hardcode credentials.

Frontend (from `trading-analysis-platform/frontend/`):

```bash
npm install
npm run dev          # ALWAYS http://localhost:5174 (strictPort; do not let it drift)
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npx vitest run src/features/drawings/DrawingLayer.test.tsx   # single test file
npm run build        # tsc -b && vite build (must pass before considering work done)
npm run dev:redirect # optional: redirects stale 5173 bookmarks -> 5174
```

Machine quirk: this machine sits behind a TLS-intercepting proxy. npm is already configured with
`strict-ssl false`; the backend auto-generates a Windows CA bundle at startup (`app/ca_bundle.py`)
so yfinance works. If yfinance returns "SSL certificate problem", that machinery is the place to look.

## Architecture invariants (do not break these)

### SQL Server schema is pre-existing — adapt to it, never recreate it
- NEVER run `Base.metadata.create_all()` against SQL Server; tables exist. Schema changes go in
  idempotent scripts under `backend/sql/` run via `scripts/run_migrations.py`.
- Tables: `dbo.C005` users, `C006` password tokens, `C010` acciones, `C0101` drawings, `C020`
  indicator configs, `C030` layouts/analysis workspaces, `C040` user↔accion catalog, `C050`
  simulated/paper-trade entries, `C060` cached news, `C061` news↔accion links, `C062` market-mover
  snapshots, `C063` snapshot items, `C080` market-intelligence/sentiment/macro cache, `C081` scorecard
  scoring configs, `C090` portfolios, `C091` portfolio positions, `C092` user key/value preferences,
  `C110` AI chat conversations,
  `C111` AI chat messages. Original tables have NO
  IDENTITY → new IDs come from `next_id()` (`repositories/sql_utils.py`, MAX+1); ONLY the new tables
  C006/C050/C060-C063/C080/C081/C092/C110/C111 use IDENTITY. `C030` (no IDENTITY) gained `C010Id`
  (nullable) + `Activo` via migration `009`; `C0101` gained `C030Id` (nullable, workspace-scoped
  drawings) via migration `010`; `C081` is created by migration `011`; `C050` gained snapshot columns
  via `012`; `C080` is created by migration `013`; `C090`/`C091` by `014`; `C092` by migration `015`.
  See "Analysis workspaces", "Stock Scorecard", "Market Intelligence" and "Default chart layout
  template" below.
- SQL Server does NOT support `NULLS LAST` — order with a portable
  `case((col.is_(None), 1), else_=0)` instead of `.nullslast()` (SQLite tests accept both, so only
  the real DB catches it).
- News/movers: frontend NEVER calls external providers. Backend providers live behind interfaces
  (`services/news/` and `services/market_movers/`; Yahoo via yfinance + Yahoo Finance RSS feeds
  (latest/top/per-symbol headline) + Google News RSS via httpx with bounded QUERY GROUPS, all
  best-effort: failures return [] and the SQL cache is served with a warning). Orchestrators cache
  in C060-C063 with short TTLs (`NEWS_*`/`MARKET_MOVERS_TTL_MINUTES`), dedupe news by NORMALIZED
  URL (tracking params stripped — `noticias_repository.normalize_url`) then (Proveedor, ExternalId),
  and honor `forceRefresh`. Global aggregation (`_aggregate_global_sources`) pulls Yahoo
  latest/top/trending + Google global/geopolitical/trending; `GET /api/news/top-trending-stocks-today`
  serves the "stocks moving today" section. Category classifier is keyword-based: "Geopolitics /
  Policy" includes POLITICAL/policy terms (Trump, tariffs, trade deals, shutdown, sanctions…), and
  "Top Trending Stocks Today" catches mover headlines. `?source=yahoo|google` filters by provider
  prefix. Related tickers are extracted against KNOWN C010 tickers only (stopwords: USA/CEO/ETF…)
  and linked via C061. AI/ChatGPT contexts include max 5 symbol headlines + top 3 global + top 3
  trending (from the SQL cache, never live calls) — prompts say not to invent news. Frontend:
  dedicated pages `features/news/` (NewsPage at `/news`: filters, per-symbol panel, Top Trending
  Stocks Today) and `features/marketMovers/` (MarketMoversPage at `/market-movers`); both have
  their own zustand store + Api service and reach the backend only.
- Symbol news is STRICT, global news is broad — never share rules between them
  (`services/news/news_relevance.py`). Per-symbol: queries are built from C010 metadata
  (`build_symbol_news_queries` — company name first, ticker second; never the raw ticker word),
  every item gets a relevance score (`score_symbol_news_relevance`: company aliases, `{T} stock/
  shares/earnings`, NYSE/NASDAQ context, provider-linked bonus for Yahoo per-ticker feeds,
  per-ticker false-positive phrases) with threshold 40 (normal) / 70 (AMBIGUOUS_TICKERS: OPEN,
  AI, ON, NOW, SHOP…). C061 links are created ONLY above threshold (score stored in
  `C061.Relevancia`); below it the item is kept in C060 without a link only if it has global
  market value. Reads RE-score rows (cleans historically contaminated C061 links — "SpaceX Open
  IPO" never shows for OPEN) and each item carries `relevanceScore`/`relevanceReason`; empty
  result returns a `message`, never generic filler. Aliases starting with the ambiguous ticker
  itself ("ON Semiconductor") match case-SENSITIVELY. Global: interleaved query groups
  (market/geopolitics/macro-Fed/sector/trending, ≤`NEWS_GLOBAL_MAX_QUERIES_PER_REFRESH`=30) and
  read-time ranking `global_rank_score` (freshness dominates; boosts for quality publishers,
  market-impact keywords, high-impact categories). `NEWS_DEBUG=true` logs queries, per-item
  scores and rejection reasons.
- Drawings are EDITABLE with the cursor tool: selecting a line makes the overlay interactive
  (pan/zoom pauses); drag the body (preserves slope) or an endpoint handle (10px radius), draft
  renders live and persists on pointer-up via `drawingStore.updateDrawing` (PATCH; rejects
  `Bloqueado=1` with 423 unless unlocking; `Version` is the MIGRATION version — never bump it as an
  edit counter). Escape cancels without persisting.
- Channel R/R auto-detection is STRICT per timeframe: `detectChannels(drawings, refPrice,
  targetTimeMs, { timeframe })` only pairs lines whose `sourceTimeframe === timeframe`
  (`showOnAllTimeframes` is VISUAL-only — never detection eligibility). Pairing compares angles
  in normalized coordinates (`pairAngleDifferenceDegrees`, tolerance 15°) — NEVER raw Unix-ms
  slopes; no time-overlap requirement (lines extrapolate to the reference time; overlap only
  boosts confidence); width 0.5–80% of price; reference up to 10% outside the channel is detected
  with a `note` instead of rejected. Hidden/locked drawings and non-line types are excluded.
  Reference = canonical quote price at the panel's latest REAL candle time
  (`normalizeChartTimeToMs` in `timeConversion.ts` guards seconds vs ms — never wall clock).
  Results live in `channelRiskRewardStore.autoByTimeframe` keyed by timeframe key (computed centrally
  in `ChannelRiskRewardPanel` by iterating the ACTIVE workspace's slot source-timeframe keys, falling
  back to `PRESET_KEYS` when no workspace is loaded); each `ChannelRiskRewardBadge` (in ChartCanvas)
  reads ONLY its own key. `activeChartPreset` (set by clicking a chart; now a `string` contextKey)
  drives the left panel and the AI context (`chartTimeframe` field — only the active chart's channel
  is sent, never all six). Manual selection remains as a collapsed fallback and MAY mix timeframes.
  Debug via `VITE_CHANNEL_RR_DEBUG=true` (`[ChannelRR]` console.debug logs per-pair rejection reasons).
- Naming convention: physical SQL tables use CODE-ONLY names (`C110`, never `C110_ChatConversaciones`);
  PK/FK columns are exactly `CxxxId` (`C110Id`, `C005Id` — never `C005ID`, `UserId`, `usuario_id`).
  Descriptive names (C110-ChatConversaciones) exist only in documentation.
- `C005.NombreNormalizado` and `C010.TickerNormalizado` are **persisted computed columns**
  (`UPPER(TRIM(...))`): never write them; normalize lookups to UPPER instead (repos use
  `func.upper(func.trim(...))` so SQLite tests behave identically).
- Soft deletes only: users → `Activo=0` + `FechaDesactivacion`; drawings → `Eliminado=1`;
  catalog rows → `Activo=0`; AI conversations → `C110.Activo=0`. No physical DELETEs of user data,
  with ONE deliberate exception: `DELETE /api/admin/users/{id}/hard-delete` (purge test users:
  children first — C111 (via the user's C110 ids) → C110 → C081 → C092 → C091 → C090 →
  C050/C006/C0101/C020/C030/C040 — then C005, single transaction — `UsersRepository.hard_delete_user`;
  C091 antes que C090 por la FK; guards: not self, not the last active admin; frontend requires typing
  DELETE).

### Auth rules
- No public registration; admins create users (`/api/admin/users`). Created users get a password
  **setup email link** (`FRONTEND_URL/set-password?token=...`); never email plaintext passwords.
- Password tokens: raw token only in the email link; DB stores HMAC-SHA256 hash (`security/tokens.py`,
  keyed by `JWT_SECRET_KEY`); one-time use; SET=24h, RESET=1h. Without SMTP in dev the link is logged
  (logger `email_service`) and the API returns `setupEmailSent: false` — tests rely on that log.
- Login accepts Email or NombreUsuario; blocked only when `Activo=0`. `DebeCambiarPassword=1` does
  NOT block login: the JWT is issued and the FRONTEND forces `/change-password` (ProtectedRoute
  redirects every other protected route there until the flag clears).
- Self-service recovery: `POST /auth/forgot-password` (EXPLICIT responses by design — 404 unknown
  email, 403 inactive, 200 sends RESET link to `FRONTEND_URL/reset-password?token=...`); it must
  NEVER create users or tokens for unknown emails. `/auth/reset-password` shares the same internal
  flow as `/auth/set-password` (one-time token, active user only). `/auth/change-password`
  (authenticated) requires the current password and clears `DebeCambiarPassword`. `PATCH /auth/me`
  edits ONLY own nombre/email (dupe-checked); it can never touch EsAdmin/Activo/PasswordHash.
- Admin password tools: `set-temporary-password` (requireChange default True → forced change on next
  login; password never emailed/returned), `force-password-change` (flag only), `send-password-reset`
  (active users only; also sets the flag).
- `PasswordHash` never leaves the API. JWT (`security/jwt.py`): sub=C005Id, username, is_admin.
- ALL app endpoints require Bearer (market data included — wired via router `dependencies` in
  `main.py`). The whole `auth.router` is mounted public (no router-level dep) — its protected
  endpoints (`/auth/me`, `PATCH /auth/me`, `/auth/change-password`) enforce auth inside the
  handler. No-auth endpoints: `/api/health`, `/api/health/db`, `/api/auth/login`,
  `/api/auth/validate-password-token`, `/api/auth/set-password`, `/api/auth/reset-password`,
  `/api/auth/forgot-password` (these last two are self-service recovery — see Auth rules). The
  frontend `apiClient` PUBLIC_PATHS must list the same auth paths.
- Every data repo call is scoped by `C005Id` — a user must never see another user's rows; drawing
  updates go through `get_owned()`. Last-active-admin protections: cannot deactivate or de-admin the
  last active admin.
- `bcrypt` is pinned to 4.0.1 (passlib 1.7.4 compatibility); don't bump casually.

### Frontend auth wiring
- Routes in `main.tsx`: `/login`, `/forgot-password`, `/set-password`, `/reset-password` (public,
  unauthenticated); then ProtectedRoute pages `/news` (NewsPage), `/market-movers`
  (MarketMoversPage), `/account` (My Account: own profile + change password, every authenticated
  user), `/change-password` (forced change), `/admin/users` (AdminRoute), `/*` (ProtectedRoute →
  App). Token stored via `features/auth/authToken.ts` (`tap.auth.token.v1`) — a standalone module
  to avoid import cycles; `authStore` (zustand) holds user/session state.
- Separation of concerns: `/account` is personal (never lists other users); `/admin/users` is
  admin-only user management. Header links: 📰 Noticias (`news-link` → `/news`) and 🚀 Movers
  (`movers-link` → `/market-movers`) for everyone, 👤 Mi cuenta (`account-link`) for everyone,
  ⚙ Usuarios (`admin-link`) only when `esAdmin`.
- `services/apiClient.ts` attaches `Authorization: Bearer` and, on 401 from a non-public path, clears
  the token and redirects to `/login`. PUBLIC_PATHS must stay in sync with the backend's public list.
- Store repo selection: `import.meta.env.MODE === "test"` → LocalStorage repos (jsdom tests stay
  offline); otherwise Api repos. Keep this conditional when touching the stores.
- Indicator configs sync to SQL via `features/indicators/indicatorSync.ts` (GET on app mount, debounced
  PUT 800ms); guarded out of test mode in `App.tsx`.

### AI Chat (OpenAI) rules
- `OPENAI_API_KEY` lives ONLY in `backend/.env` (empty key → clean 503 "IA no disponible"; never
  hardcode, log, or send it to the frontend). The frontend NEVER calls OpenAI directly — everything
  goes through `/api/ai/*` (`routers/ai_chat.py`), Bearer-protected like the rest of the app.
- Conversations (`C110`) and messages (`C111`) are scoped by `C005Id` via `ChatRepository` —
  ownership is checked on every read/write (`get_conversation_for_user`); cross-user access is 404.
- Context (`services/ai_context_service.py`) is concise and safe: quote + 1Y daily summary,
  C020 indicator configs + current SMA/EMA/RSI values, summarized C0101 drawings (capped at
  `AI_CHAT_MAX_DRAWINGS_CONTEXT`), C040 watchlist notes, yfinance news (`news_service.py`,
  best-effort; `news_available:false` when missing so the model doesn't invent news). It must NEVER
  include PasswordHash, tokens, emails of other users, or other users' data — there's a test for it.
- Each section of the context catches its own exceptions: market/news failures never break the chat,
  and an AI failure never breaks the dashboard (the user message stays persisted in C111).
- Send flow stores the user message FIRST, then calls OpenAI (Responses API preferred, fallback to
  chat.completions), then stores the assistant reply with token counts. History sent to the model is
  capped at `AI_CHAT_MAX_CONTEXT_MESSAGES`. In-memory per-user rate limit
  (`AI_CHAT_MAX_MESSAGES_PER_MINUTE`) returns 429.
- Frontend: `features/aiChat/` (zustand store + drawer panel scoped to the active ticker; ✨ button
  in the Header). Tests mock `openai_service.generate_reply`, `_market_summary`, and
  `news_service.get_symbol_news` — no network ever.
- SECOND AI mode — ChatGPT iframe/helper (`features/chatgptIframe/`, 🤖 button): NO OpenAI API, NO
  C110/C111 writes. `GET /api/chatgpt/context` (auth, read-only) feeds a client-side prompt builder
  (8 prompt types + 6 context toggles in `chatGptPromptService.ts`); user copies the prompt into
  their own ChatGPT session (iframe with 5s-timeout fallback → "open in new tab", which copies
  first). Never read/inject/scrape the iframe (cross-origin). Both panels are mutually exclusive
  (each button closes the other store). `VITE_CHATGPT_IFRAME_*` env vars configure URL/enabling.

### Watchlist (C040) rules
- Removing from the watchlist = `C040.Activo=0` for the CURRENT user only, behind a confirmation
  modal. NEVER delete the master `C010` row nor the user's drawings/indicators/layouts/AI chats.
- The ★ star is real: `C040.Favorito` via `PATCH /api/catalog/{c010Id}/favorite` (also `pinned` in
  the generic PATCH). Backend list order: `Favorito DESC, UltimaConsulta DESC, Ticker ASC`; sidebar
  has a "Solo favoritos" filter and sorts favorites first.

### Simulated entries (C050) & channel risk/reward
- `dbo.C050` = paper-trade entries per user+accion (LONG/SHORT, ABIERTA/CERRADA). API
  `/api/simulated-trades` (auth, scoped by C005Id); soft delete = `Activo=0 AND Visible=0`.
  Performance: open entries use the canonical quote; CERRADA uses `PrecioSalida` (realized).
  Watchlist removal NEVER touches C050.
- Chart marking is TWO layers (migration `012`): a SECONDARY dashed price line at the entry price
  (`ChartInstance.setSimulatedEntryLines`) PLUS the PRIMARY exact-point marker
  (`setSimulatedEntryMarkers`) — an arrow anchored to entry **time+price** (LONG=arrowUp/green
  belowBar, SHORT=arrowDown/red aboveBar, label `TYPE price`). The adapter snaps each marker's ms
  time to the NEAREST real candle of that chart (markers need a time present on the series) and
  sorts ascending (LWC requirement). Both methods are OPTIONAL on the interface so fake
  ChartInstance objects in tests don't break.
- Workspace + analysis snapshot (migration `012` adds `C050.C030Id` NULL + `MetadataJSON` +
  `AnalisisJSON`): entries are workspace-scoped like drawings — the panel loads `load(symbol,
  c030Id)` for the active workspace (`loadedWorkspaceBySymbol`); the repo filters
  `C030Id == c030_id OR C030Id IS NULL` (legacy rows visible everywhere). At creation
  `captureAnalysisSnapshot(symbol)` (`simEntrySnapshot.ts`) reads the workspace/scorecard/channel
  stores via `getState()` and builds `metadata` (chart/workspace/capturedAt) + `analysisSnapshot`
  (`createdFrom:"SIM_ENTRY_TOOL"`, scorecard subset, real `technicalContext`, channelRiskReward).
  The create modal also captures the **thesis** (entryThesis/bullishScenario/bearishScenario/
  invalidationLevel/targetArea) → backend `_build_analysis_json` merges them under
  `AnalisisJSON.simulatedEntryThesis`. `GET /simulated-trades/{id}` returns the detail
  (`metadata`/`analysisSnapshot`); `PATCH` of thesis merges into `simulatedEntryThesis` WITHOUT
  overwriting the rest of the snapshot. Frontend `features/simulatedTrades/`: `SimulatedTradeModal`
  (preview + thesis + snapshot capture), `SimulatedTradeDetailModal` (snapshot vs current
  comparison — 📍 Localizar makes the marker visible, 🔍 Análisis opens the detail),
  `SimulatedTradesPanel`, zustand store (`openDetail`/`closeDetail`) + Api service.
- Channel R/R (`features/channelRiskReward/`) is FRONTEND-ONLY math over two ~parallel line
  drawings: `getLinePriceAtTime` interpolates/extrapolates in **ms** (never LWC seconds);
  upper/lower swap automatically; reward<=0 / risk<=0 produce `invalidReason` instead of a ratio.
  Auto-detection runs per preset (strict `sourceTimeframe` scoping — see the invariant above);
  the panel shows ONLY the active chart's channel (fallback: highest confidence) and the
  effective `result` flows into BOTH AI prompts: the ChatGPT prompt builder reads it at rebuild,
  and `aiChatStore.sendMessage` sends it as the optional `channelRiskReward` field (merged into
  the model context server-side) — both include `chartTimeframe` (null under manual override).
  Both AI contexts also include `simulatedEntries`. Everything is labeled hypothetical — never
  investment advice.

### Timeframes are defined twice and must stay aligned
The six presets — `4Y_1W` (weekly!), `1Y_1D`, `6M_1D`, `3M_1D`, `1M_1H`, `1W_30M` — are defined in
`frontend/src/utils/timeframes.ts` AND `backend/app/timeframes.py` (same keys/intervals). Change both
or neither. `4Y_1D` is a legacy key that migrations rewrite to `4Y_1W`. These six presets are now the
DEFAULT analysis workspace's slot config (panels are per-workspace configurable — see next section);
the `PresetKey` union and these files remain for back-compat (canonical-price fallback order, future
whitespace step records, drawing migration, refresh tests).

### Analysis workspaces & configurable chart slots (C030)
The dashboard renders SIX panels, but each panel's range+interval is user-configurable and a stock can
have MULTIPLE analysis workspaces (tabs). One `C030` row = one workspace.
- **Storage**: `C030` rows are workspaces scoped by user+stock. Migration `009_chart_workspaces.sql`
  added `C010Id` (nullable — NULL = legacy global UI layout consumed by `/layouts/default`; set = a
  stock workspace) and `Activo` (soft delete). Six `{slotId,range,interval}` live in
  `ConfiguracionJSON.chartSlots`. `LayoutsRepository.get_default_by_user` filters `C010Id IS NULL` so
  the global layout never mixes with workspaces. Central backend module: `app/chart_workspaces.py`.
- **Endpoints** (`routers/layouts.py`, auth, scoped by C005Id): `GET/POST /api/layouts/stock/{symbol}`
  (GET auto-creates a "Default Analysis" if none; POST `{name, copyFromC030Id?}` — first workspace is
  default), `PATCH /api/layouts/{c030Id}` (rename — `.strip()`, rejects empty 400; isDefault; config),
  `PATCH …/chart-slots` (merge by slotId — preserves untouched slots), `PATCH …/set-default`, `DELETE`
  (soft delete `Activo=0`; **409 on the LAST workspace**; reassigns default). Delete NEVER touches
  drawings/indicators/trades/AI/watchlist/news.
- **Range/interval are a SINGLE source of truth**: `AVAILABLE_INTERVALS_BY_RANGE` +
  `DEFAULT_INTERVAL_BY_RANGE` exist in BOTH `backend/app/chart_workspaces.py` AND
  `frontend/src/features/charts/chartRangeIntervalConfig.ts` — keep aligned. The interval dropdown
  shows ONLY available intervals (NO disabled options); changing range auto-coerces an invalid
  interval to the range default (with a toast). Invalid saved combos are repaired on load
  (`normalizeChartSlots` / `merge_chart_slots`, both ends). `GET /api/market/candles?symbol&range&
  interval` serves dynamic OHLCV (warmup supported); unsupported combos → **422**
  `{error,message,range,interval,availableIntervals}` (the frontend pre-validates, so this is a safety net).
- **contextKey & drawings**: a slot's "source timeframe" = `slotSourceTimeframe(slot)`. The SIX
  DEFAULT combos map to the HISTORICAL preset keys (`5Y/1wk→4Y_1W`, `1Y/1d→1Y_1D`, …) so existing
  drawings/channels/colors keep their identity WITHOUT migration; custom combos use the contextKey
  `${range}_${interval}`. Timeframe-key types were WIDENED from the fixed `PresetKey` union to `string`
  across drawings/colors/filters/futureWhitespace/channel/ChartCanvas/DrawingLayer; drawing filters
  default unknown keys to VISIBLE (only an explicit `false` hides); whitespace step derives from the
  interval token for non-preset keys.
- **Stores**: `features/charts/chartWorkspaceStore.ts` holds `workspacesBySymbol` +
  `activeWorkspaceBySymbol` (active selection persisted to `tradingPlatform.activeWorkspaceBySymbol`;
  C030 is the source of truth for configs). `chartStore` is SLOT-based now:
  `chartDataBySlot`/`loadingBySlot`/`errorBySlot` + `currentSlots`; `loadWorkspaceSlots` /
  `reloadSlot` (single slot) / `refreshAllPresets` (refreshes the ACTIVE workspace's slots — name
  kept so the refresh feature is untouched). `ChartGrid` renders the active workspace's slots +
  `WorkspaceTabBar`; `symbolStore.selectSymbol` loads workspaces. Legacy preset fields remain on
  `chartStore` (chartDataByPreset etc.) only for back-compat tests.
- **UI**: `WorkspaceTabBar` renders the tabs; its `⋯` menu is in a **React portal** (must NOT be
  clipped by the bar's `overflow-x-auto` — that was the original "can't rename/delete" bug). Rename is
  inline; delete is a confirmation modal; duplicate makes `"{name} Copy"`. Per-panel
  `SlotConfigSelector` (range + interval). Toasts via `components/ui/toastStore.ts` + `<Toaster/>`
  (mounted in `AppShell`).
- **AI context**: AI Chat sends an optional `workspace` field (active workspace name + its six slot
  configs) → backend merges it as `activeWorkspace`; the ChatGPT prompt builder appends the same. Only
  the ACTIVE workspace is sent, never inactive ones.

### Default chart layout template (C092, per-user)
A user-editable TEMPLATE for the six-chart slots applied to NEW analysis only. Stored as a user
preference in `dbo.C092` (key/value JSON; key `DEFAULT_CHART_LAYOUT_TEMPLATE`), scoped by `C005Id`.
Migration `015_user_preferences.sql`; model `PreferenciaUsuario`; repo `UserPreferencesRepository`
(`get_active`/`upsert`/`deactivate`; ONE active row per `C005Id`+`ClavePreferencia` via a filtered
unique index `WHERE Activo=1`).
- **Endpoints** (`routers/user_preferences.py`, prefix `/user-preferences`, auth en handler, por
  `C005Id`): `GET /default-chart-layout-template` → `{chartSlots, isUserTemplate}` (la plantilla del
  usuario saneada o el default del sistema), `POST` valida con `validate_template_slots` (exactamente
  seis slots, ids `chart_1..chart_6`, combos range/interval soportados → `422` si no) y hace upsert,
  `DELETE` desactiva (restablece el default). `load_default_chart_slots(db, user_id)` (mismo módulo)
  devuelve los slots de la plantilla o `DEFAULT_CHART_SLOTS`; NUNCA lanza.
- **Apply-to-new only**: `layouts.py` pasa `chart_slots=load_default_chart_slots(...)` al crear el
  workspace en `GET /layouts/stock/{symbol}` (autocreación del primer workspace) y en `POST` SIN
  `copyFromC030Id`. **Duplicar** (`copyFromC030Id`) copia los slots del workspace ORIGEN, no la
  plantilla. Cambiar la plantilla NO reescribe workspaces existentes. `chart_workspaces.py` exporta
  `CHART_SLOT_IDS`, `DEFAULT_CHART_LAYOUT_TEMPLATE_KEY`, `validate_template_slots` y
  `default_workspace_configuration(..., chart_slots=None)`.
- **Hard-delete**: `hard_delete_user` borra también las filas C092 del usuario (en el loop, tras C081).
- **Frontend** (`features/charts/`): `userPreferencesApi.ts` (getTemplate/saveTemplate/resetTemplate),
  `chartWorkspaceStore.applyChartSlots(symbol, c030Id, slots)` (PATCH de los SEIS slots → devuelve los
  saneados para recargar), y `ChartTemplateMenu.tsx` (botón **Plantilla ▾** en `ChartToolbar`):
  Guardar como plantilla predeterminada (envía los seis slots del workspace activo), Aplicar plantilla
  a este análisis (modal de confirmación → `applyChartSlots` + `chartStore.loadWorkspaceSlots`; los
  dibujos se mantienen), Restablecer plantilla del sistema. Etiquetas en español.

### Stock Scorecard (heurística, NO asesoría financiera)
Resumen ejecutivo por acción: `GET /api/stocks/{symbol}/scorecard` (auth; query `forceRefresh`,
`workspaceId`, `focusedChartSlotId`). `services/stock_scorecard_service.py` reutiliza los helpers de
`ai_context_service` (mismas velas 1Y diarias) y puntua 0-100 técnico/fundamental/noticias/sentimiento;
`overallScore` es promedio ponderado con pesos del config (REDISTRIBUYE cuando falta un componente).
- **Config-driven** (`dbo.C081`, varias filas/perfiles por usuario): pesos + umbrales editables en
  `ConfiguracionJSON`. `services/scorecard_config.py` tiene `DEFAULT_SCORECARD_CONFIG` (incluye
  `sentiment.{vixLowRiskMax:16,vixMediumRiskMax:24,vixHighRiskAbove:30}` que consume
  `_score_sentiment`) + `merge_with_default` (una config parcial/corrupta SIEMPRE se funde con el
  default → nunca rompe el cálculo) + `validate_config`/`InvalidScorecardConfig` (pesos numéricos
  ≥ 0 y total **100**). El servicio carga el default del usuario
  (`ScorecardConfigRepository.get_or_create_default`) en cada cálculo. Endpoints CRUD:
  `/api/scorecard/configs` (GET/POST), `…/configs/default`, `PATCH /configs/{id}`, `…/set-default`,
  `POST /configs/reset-default` (restaura el default del sistema), `DELETE` (bloquea la última; soft
  delete `Activo=0`). create/PATCH validan vía `_validated` → `422 {"error":
  "INVALID_SCORECARD_CONFIG","message":...}` si los pesos no suman 100. Todo acotado por `C005Id`.
- **Breakdown**: la respuesta incluye `breakdown.{technical,fundamentals,news,sentiment}.metrics[]` —
  cada métrica reporta `value/displayValue/source/status (POSITIVE|NEUTRAL|NEGATIVE|MISSING)/
  scoreContribution/maxContribution/explanation` — y `scoringConfig {c081Id,name,version}`. Sources:
  Yahoo Finance / cálculo técnico interno / News module / Market data / User drawings. Fundamentales
  via `yahoo_service.get_fundamentals` (`ticker.info`, NO ROIC.ai, NO proveedor de pago); campos
  ausentes → status MISSING.
- **Frontend** (`features/stockScorecard/`): tarjeta compacta en la sidebar + **vista completa VISUAL**
  (`StockScorecardFullView`): puntaje general con barra + fila de 4 tarjetas de puntaje, y métricas
  como `ScoreMetricCard` (estado por color, valor, barra de contribución `x / y pts`, fuente
  abreviada) agrupadas por bloque (`TECHNICAL_GROUPS`/`FUNDAMENTAL_GROUPS`/`groupMetrics`). La pestaña
  *Ajustes* (`ScorecardSettings`) edita pesos (con total + validación + botón **Normalizar a 100 %**),
  umbrales técnicos/fundamentales/noticias/**sentimiento (^VIX)** y gestiona **perfiles**
  (`ScorecardConfigSelector`: activo, Guardar, Guardar como nuevo, Fijar predeterminado, Restaurar
  default). `stockScorecardStore` (por símbolo) + `scorecardConfigStore` (`defaultConfig`+`configs[]`,
  con `weightsTotal`/`normalizeWeights`, `resetDefault`). El AI Chat (`buildScorecardExplainMessage`)
  y el prompt de ChatGPT incluyen los valores reales del breakdown (`scorecardKeyMetricsLines`).
- **Tooltips "?"** (`ScorecardInfoTooltip` + `stockScorecardHelp.ts`): cada tarjeta de puntaje
  (technicalScore/fundamentalScore/newsScore/sentimentScore/overallScore/riskLevel/confidence) y cada
  `ScoreMetricCard` muestran un "?" hover/click. La clave de ayuda de una métrica se resuelve con
  `metricHelpKey()` (`scorecardMetricHelpKeyMap.ts`: backend `sma20→priceVsSma20`, `bollinger→
  bollingerPosition`, `priceToSales→priceSales`, etc.); si no hay entrada, NO se muestra icono. En las
  `ScoreCard` (que son `<button>`) el "?" va como hermano absoluto, nunca anidado. Solo educativo: no
  cambia el cálculo.

### Market Intelligence & sentiment proxy (Fase 2, C080)
Página `/market-intelligence` (`MarketIntelligencePage`) que da el entorno de mercado ANTES de analizar
una acción. NO reemplaza el dashboard; NO es asesoría financiera (proxy de sentimiento, no el índice
oficial de CNN). El frontend NUNCA llama a Yahoo directo: todo via `GET /api/market-intelligence/*`
(auth en handler).
- **Endpoints** (`routers/market_intelligence.py`, prefix `/market-intelligence`): `GET /overview`
  (índices + sentimiento + fearGreed + movers summary + topNews + whatThisMeans) y `GET /sentiment`
  (solo el proxy), ambos con `?forceRefresh`. Flags `ENABLE_MARKET_INTELLIGENCE`/`ENABLE_MARKET_SENTIMENT`.
- **Sentiment service** (`services/sentiment/`): arquitectura de proveedores
  (`SentimentProvider` base + `InternalMarketSentimentProvider`). Pondera VIX 30 % / S&P 25 % / NASDAQ
  15 % / Russell 10 % / breadth de movers 10 % / tono de noticias 10 %; si falta un componente
  **redistribuye** el peso y baja la confianza (sin VIX nunca es HIGH). Score 0-100 → label
  `EXTREME_FEAR/FEAR/NEUTRAL/GREED/EXTREME_GREED` (display español en el front). Nunca lanza: todo
  ausente → `score=None, label=UNAVAILABLE` con warning.
- **MI service** (`services/market_intelligence_service.py`): índices best-effort (quote + sparkline 3M
  diario + tendencia), REUTILIZA `market_movers_service.get_all_lists` y `news_service.get_global_news`
  (no duplica C062/C063 ni C060), deriva el sentimiento de los mismos datos de índices ya descargados,
  y arma `whatThisMeans` (reglas, sin IA). Cada sección captura su excepción → `warnings`; nunca tumba
  el endpoint. Ante fallo total cae al último cache (`get_latest_any`) con warning.
- **Cache C080** (`MarketCache` model + `MarketCacheRepository`): cache COMPARTIDO (no por usuario),
  `store()` inserta fila IDENTITY y desactiva las previas de la misma `(TipoDato, Clave)`; `get_fresh`
  lee la activa no expirada, `get_latest_any` la última aunque esté expirada. TTLs:
  `MARKET_INTELLIGENCE_TTL_MINUTES`/`MARKET_SENTIMENT_TTL_MINUTES` (15). NUNCA guarda datos de usuario
  ni secretos.
- **Integraciones**: el Scorecard añade `sentimentSource` (`internal_market_sentiment_provider` |
  `unavailable`) y su `_score_sentiment` usa los mismos umbrales ^VIX; el AI Chat envía un campo
  opcional `marketIntelligence` (merge server-side) leído del `marketIntelligenceStore`; el prompt de
  ChatGPT añade toggle **Inteligencia de Mercado** + tipo `market_context_analysis`.
- **Frontend** (`features/marketIntelligence/`): `MarketIntelligencePage` compone `MarketSentimentPanel`
  (`FearGreedGauge` gradiente miedo→codicia + desglose), `MajorIndicesPanel`/`MajorIndexCard` (sparkline
  SVG), `MarketMoversSummaryPanel` (link a `/market-movers`), `MarketNewsSummaryPanel` (link a `/news`),
  `WhatThisMeansPanel` (✨ Preguntar a la IA), `MarketIntelligenceRefreshButton`. Store
  `marketIntelligenceStore`. Link en el Header (`market-intelligence-link` 🧠) para todos los autenticados.

### Macro Dashboard (Fase 3, C080)
Página `/macro` (`MacroPage`) con el entorno macro: tasas, inflación, empleo, curva, mercados globales
y calendario. NO reemplaza Market Intelligence; es informativo (no señal de compra/venta). `GET
/api/macro/overview?forceRefresh` (auth en handler). REUSA la tabla C080 (NO crea tabla nueva).
- **Proveedores OPCIONALES** (`services/macro/`): `FredProvider` (indicadores de EE.UU.; requiere
  `FRED_API_KEY`, sin clave → todos MISSING + warning, NUNCA falla), `yahoo_macro_provider` (proxies de
  mercado: Tesoro ^FVX/^TNX/^TYX + FX incl. **USD/MXN (MXN=X)** + commodities + cripto vía
  `yahoo_service`), `economic_calendar_provider` (ver abajo). El 2A del Tesoro sólo viene de FRED
  (DGS2); sin él la curva es UNKNOWN.
- **Producción industrial (INDPRO) + Ventas minoristas (RSAFS)**: reemplazan a los ISM PMI
  (descontinuados gratis en FRED). Series CONFIGURABLES vía env `FRED_SERIES_INDUSTRIAL_PRODUCTION` /
  `FRED_SERIES_RETAIL_SALES` (ver `ENV_SERIES_OVERRIDE`/`PERCENT_CHANGE_KEYS` en `fred_provider.py`);
  trend por latest vs previous, `retailSales` reporta `changePercent` y se muestra en miles de millones
  (`usd_millions_to_b`). El front ya NO renderiza `ismManufacturing`/`ismServices`.
- **Calendario FRED** (`economic_calendar_provider.build_calendar` + `fred_release_config.py`): con
  clave arma el calendario desde `fred/release/dates` para los releases de `IMPORTANT_FRED_RELEASES`
  (CPI/NFP/GDP/PCE/FOMC/retail/sentimiento), release IDs resueltos por keyword y cacheados en C080
  (`FRED_RELEASE_IDS`). Devuelve `(events, warnings, available, source)`; el overview añade
  `economicCalendarAvailable`/`economicCalendarSource`. Sin clave o sin datos útiles → `available=False`
  y el FRONT OCULTA el panel (no muestra una tarjeta vacía). NUNCA inventa fechas.
- **Interpretación por reglas** (`macro_interpretation_service`): `yield_curve_status` (spread 10A-2A:
  >0.5 NORMAL, 0–0.5 FLAT, <0 INVERTED, None UNKNOWN), `compute_risk` (GREEN/YELLOW/RED/UNKNOWN +
  score + drivers/risks; usa inflación, nivel de tasas, empleo, PIB, curva y el VIX/sentimiento del
  cache de Fase 2), `executive_summary`, `what_this_means`.
- **macro_service** (`get_overview`): agrega best-effort, cachea en C080 (`MACRO_OVERVIEW`, TTL
  `MACRO_CACHE_TTL_MINUTES`=60), fallback a cache viejo ante fallo total. `get_macro_context(db)` lee
  SOLO el cache (sin red) y lo consumen el Scorecard (campo `macroContext` + un watchItem si el riesgo
  es YELLOW/RED) y el AI Chat — si la página macro no se ha cargado, es None y nada falla.
- **Integraciones**: AI Chat envía un campo opcional `macro` (merge server-side); el prompt de ChatGPT
  añade toggle **Macro** + tipo `macro_market_stock_decision`; la página de Inteligencia muestra una
  `MacroRiskMiniCard` compacta si el overview macro está disponible (defensiva: si no, no renderiza).
- **Frontend** (`features/macro/`): `MacroPage` compone `MacroExecutiveSummary` (badge de riesgo +
  drivers/risks), `InflationLaborPanel`, `UsaIndicatorsPanel`, `RatesYieldCurvePanel` (curva SVG +
  badge), `GlobalMarketsPanel` (FX/commodities/cripto), `EconomicCalendarPanel`, `MacroMeaningPanel`
  (✨ Preguntar a la IA); `MacroDataCard`/`MacroTrendBadge`/`MacroRiskBadge` reutilizables. Cada tarjeta
  lleva un **`MacroInfoTooltip`** ("?" hover/click; textos en `macroIndicatorHelp.ts`, lookup por
  `helpKey` que por defecto es la `key` — para FX/commodities/cripto se pasa `helpKey` de categoría).
  El **`EconomicCalendarPanel` solo se monta si hay eventos** (`MacroPage` lo condiciona a
  `economicCalendarAvailable && length>0`); si no, el `MacroMeaningPanel` ocupa el ancho — NUNCA un
  panel grande vacío. Store `macroStore`. Link en el Header (`macro-link` 🌐). Vars de entorno:
  `ENABLE_MACRO_DASHBOARD`, `MACRO_CACHE_TTL_MINUTES`, `MACRO_DEBUG`, `FRED_API_KEY`,
  `FRED_API_BASE_URL`, `FRED_SERIES_INDUSTRIAL_PRODUCTION`, `FRED_SERIES_RETAIL_SALES`,
  `ECONOMIC_CALENDAR_PROVIDER`, `ECONOMIC_CALENDAR_API_KEY`, `ECONOMIC_CALENDAR_TTL_MINUTES`.

### Portfolio Analysis (Fase 4, C090/C091)
Página `/portfolio` (`PortfolioPage`) para crear portafolios y posiciones y analizar valor, ganancia/
pérdida, asignación, concentración, comparación vs S&P 500 y un resumen de IA. **Separado del
watchlist** (C040): el watchlist son acciones seguidas; el portafolio son tenencias con cantidad/costo.
Informativo, NO asesoría financiera. Migración `014_portfolios.sql`.
- **Tablas NUEVAS IDENTITY**: `C090` portafolios (user-scoped, `EsDefault`/`Activo`, primer portafolio
  = default) y `C091` posiciones (FK a C090/C005/C010; `C005Id` se guarda TAMBIÉN en C091 para acotar
  por usuario sin join). Borrado suave `Activo=0`; borrar un portafolio desactiva sus posiciones.
  `PortfolioRepository` acota TODO por `C005Id`. Hard-delete: C091 antes que C090 (FK).
- **Endpoints** (`routers/portfolios.py`, prefix `/portfolios`, auth en handler, todo por C005Id):
  `GET/POST /portfolios`, `PATCH/DELETE /portfolios/{c090Id}`, `PATCH …/set-default` (quita default de
  los demás), `GET/POST /portfolios/{c090Id}/positions`, `PATCH/DELETE /portfolios/positions/{c091Id}`,
  `GET /portfolios/{c090Id}/analysis`, `POST /portfolios/{c090Id}/ai-summary`. Alta de posición:
  `quantity>0` y `averageCost>=0` (422 si no); enriquecimiento best-effort vía Yahoo (quote→moneda,
  `get_fundamentals`→nombre/sector/industria) + `get_or_create_from_yahoo_symbol` (C010) — JAMÁS rompe.
- **Análisis** (`services/portfolio_analysis_service.py`, nunca lanza): por posición costBasis/
  currentValue/gainLoss(%)/peso (quote canónica; si falta → `dataWarnings` y se excluye del valor);
  resumen total + mejor/peor; asignación por posición/sector/industria/tipo/moneda; concentración
  (mayor posición, top3, mayor sector) + `riskLevel` (CONSERVATIVE/MODERATE/AGGRESSIVE/
  HIGH_CONCENTRATION/UNKNOWN); benchmark vs `^GSPC` desde la fecha de compra más antigua (best-effort,
  `get_ohlcv`; sin fechas → no disponible); recomendaciones por REGLAS (concentración/sector/
  diversificación/moneda/ganadores/perdedores; lenguaje "revisar/confirmar/monitorear", nunca compra/
  venta). Métricas avanzadas (beta/vol/Sharpe/drawdown) = null con nota: NO se inventan.
- **AI summary**: `POST …/ai-summary` reutiliza `openai_service.generate_reply`; sin `OPENAI_API_KEY`
  → `{available:false, message}` limpio. El AI Chat recibe un campo opcional `portfolio` (merge
  server-side) y el prompt de ChatGPT añade toggle **Portafolio** + tipo `portfolio_analysis`.
- **Frontend** (`features/portfolio/`): `PortfolioPage` compone `PortfolioSelector` (crear/editar/
  eliminar/predeterminar/refrescar; prompts), `PortfolioSummaryCards`, `PositionsTable` (Abrir
  dashboard vía `searchSymbol`, ★ watchlist, editar/eliminar), `PositionFormModal`,
  `PortfolioAllocationCharts` (barras CSS + alertas), `PortfolioRiskPanel`, `PortfolioBenchmarkPanel`,
  `PortfolioRecommendationsPanel`, `PortfolioAiSummaryPanel`, `PortfolioEmptyState`; export CSV.
  Store `portfolioStore`. Link en el Header (`portfolio-link` 💼). Sin migración nueva más allá de 014.

### Time units
Storage, API responses, and `DrawingPoint.time` are **Unix milliseconds UTC**. Lightweight Charts uses
**seconds** (`UTCTimestamp`). The only conversion source is
`frontend/src/features/drawings/timeConversion.ts` (`msToChartTime` / `chartTimeToMs`); `utils/dates.ts`
re-exports it. Convert at the chart boundary only — never store seconds.

### Chart timezone display (display-only; never mutates candles)
A `Zona horaria` selector in the chart toolbar (`features/charts/timezone/`) changes only how time
labels are FORMATTED — candle timestamps stay Unix ms UTC and market data is NOT reloaded.
- **Modes** (`ChartTimezoneMode`): `EXCHANGE` / `LOCAL` / `UTC` / `FIXED_OFFSET` (UTC-12…+14) / `IANA`
  (presets like `America/Mexico_City`). Default = `EXCHANGE` when the backend knows the exchange tz,
  else `LOCAL`. Persisted per browser in `tradingPlatform.chartTimezoneMode`/`chartTimezoneValue`
  (zustand `chartTimezoneStore`; NOT in SQL — it's a UI pref).
- **Central formatter** `chartTimezoneUtils.formatChartTime` (seconds/ms/ISO input): `FIXED_OFFSET`
  shifts the instant in ms then formats as UTC; `IANA`/`UTC`/`LOCAL`/`EXCHANGE` use `Intl.DateTimeFormat`
  with the resolved `timeZone`. Pure + unit-tested.
- **Wiring**: `ChartEngineAdapter.setTimeLabelFormatters({axisTick, crosshair})` →
  `LightweightChartsAdapter` applies LWC `localization.timeFormatter` (crosshair) +
  `timeScale.tickMarkFormatter` (axis ticks; `tickMarkType >= 3` = intraday time vs date). `ChartCanvas`
  calls it on `tzSetting`/`exchangeTimezone` changes. Adapter methods are OPTIONAL so fake instances in
  tests don't break.
- **Backend**: OHLCV/candles responses carry ADDITIVE optional `exchangeTimezone`
  (`C010.TimezoneMercado` → Yahoo meta → `America/New_York` for plain US equities → `UTC`; see
  `yahoo_service._resolve_meta` + `_us_equity_default_tz`) and `dataTimezone:"UTC"`. The legacy
  `timezone` field is kept; `apiClient.OHLCVResponse` mirrors both.

### Canonical price (one price across all six charts)
The displayed "current price" (header, panel headers, sidebar, the dotted axis price line) comes ONLY
from `GET /api/market/quote` via `priceResolver.resolveDisplayPrice` (fallback order
`1W_30M → 1M_1H → 3M_1D → 6M_1D → 1Y_1D → 4Y_1W`, computed once per symbol). Every chart series is
created with `lastValueVisible:false, priceLineVisible:false`; the adapter draws a single canonical
price line (`setCanonicalPriceLine(price, change)` — color green/red/gray by `quote.change`, empty
title). Never derive a displayed price from a panel's last bar. Slot-based panels use
`resolveDisplayPriceFromSlots(quote, slotData)` (quote first, then highest-resolution slot's last
close); the preset-based `resolveDisplayPrice` remains for legacy callers/tests.

### Market data rules (backend `app/services/yahoo_service.py`)
- Raw prices only: `auto_adjust=False`, never Adj Close. All responses declare `priceBasis: "raw"`.
- One normalization path: `normalize_ohlcv_dataframe` (flattens MultiIndex, drops NaN rows, sorts, ms UTC).
- Cache keys: `ohlcv:SYMBOL:PRESET:interval:raw[:wN]` and `quote:SYMBOL` (separate caches; quote TTL 30s,
  OHLCV TTL 300s — see `app/config.py`, env prefix `TAP_`). `?forceRefresh=true` (quote/ohlcv) skips
  the cache READ but still writes the fresh result — used by the manual/auto refresh feature.
- Refresh feature (`frontend/src/features/refresh/`): `refreshNow` → `chartStore.refreshAllPresets`
  (now refreshes the ACTIVE workspace's slots; NON-destructive: keeps old candles while loading and
  per-slot on failure; never clears charts) + reloads simulated-trade performance.
- Dynamic candles: `GET /api/market/candles?symbol&range&interval` (warmup supported) backs the
  per-slot loading; cache key reuses the OHLCV cache with the contextKey `${range}_${interval}` in the
  PRESET slot. Unsupported range/interval → 422 (see "Analysis workspaces"). Auto-refresh: radio-style 5/10/15/20 min (min 5 — Yahoo rate
  safety), persisted at `tradingPlatform.autoRefreshIntervalMinutes`, timer in `useAutoRefresh`
  (mounted in App; dedupes via isRefreshing, skips ticks while the tab is hidden, refreshes once on
  return only if a full interval elapsed).
- Warmup: `?includeWarmup=true&warmupBars=N` returns `warmupBars` SEPARATE from visible `bars` plus
  `visibleFrom/visibleTo`. Indicators compute over `[...warmupBars, ...bars]` then filter output to the
  visible range; warmup bars are never rendered as candles. Intraday warmup is clamped to yfinance
  limits (1h ≈700d, 30m ≈55d) without failing.

### Chart engine adapter
`ChartEngineAdapter` interface + `LightweightChartsAdapter` isolate the app from the chart library
(future migration path). LWC **v4 has no pane API**: volume is a histogram overlay on its own price
scale (`'vol'`), toggled live via `setVolumeVisible` (it used to be mount-time-only — that was a bug);
RSI/MACD are separate stacked `MiniIndicatorChart` instances under each panel. The adapter's
`addDrawing/removeDrawing/updateDrawing` are intentional no-ops — drawings are NOT chart primitives.

### Drawings
- Stored as `{time(ms), price}` — never pixels — per user+symbol in SQL (`dbo.C0101`, via
  `ApiDrawingRepository`; localStorage repo only in test mode), rendered on an SVG overlay
  (`DrawingLayer.tsx`) with `pointer-events` active only while a tool is engaged.
- **Isolated by workspace** (`C0101.C030Id`, migration `010`): each drawing belongs to ONE analysis
  workspace; `GET /api/drawings?symbol&c030Id` loads only that workspace's rows (plus legacy
  `C030Id IS NULL` ones, but ONLY when the active workspace is the stock's default). POST REQUIRES
  `c030Id` (400 otherwise) and validates the workspace is the user's and matches the stock. The
  frontend `drawingStore` holds the ACTIVE workspace's drawings keyed by symbol (replaced on tab
  switch — see `ChartGrid` effect); `createDrawing` stamps `c030Id` from the active workspace
  (threaded ChartPanel→ChartCanvas→DrawingLayer). Channel R/R therefore only sees active-workspace
  drawings. The `DrawingIn.sourceTimeframe` schema is now a free `str` (custom slot contextKeys).
- Global across all six charts: `showOnAllTimeframes !== false` means visible everywhere; the
  per-source-timeframe filter chips (layoutStore) gate visibility; `sourceTimeframe` controls default
  color (`colors.ts`) and the filter chip that governs it.
- `free_line`/`dotted_line` are FINITE segments — clipped via `clipFreeLineSegmentToVisibleRange`,
  never extended. `extended_trendline` is projected via `projectLineToVisibleRange`. Do not conflate them.
- Cross-timeframe rendering must use `timeMsToCoordinateRobust` (native `timeToCoordinate` first; if
  the timestamp doesn't exist in the target chart's series — e.g. a daily point on the 4Y weekly
  scale — interpolate between the **native coordinates of the neighboring real bars**, and for future
  times interpolate over the whitespace grid). NEVER interpolate calendar time over the container
  width: LWC spaces bars by index (weekends take no space), the visible range includes future
  whitespace, and the overlay is wider than the plot area — width-based interpolation misaligns
  drawings into empty space. `DrawingLayer` needs the panel's `candles` + `futureInfo` for this.
  Hit-testing/eraser use the same path. Skipped renders log `[DrawingRenderSkip]` with a reason in dev.
- Future drawing: `futureWhitespace.ts` appends `{time}`-only whitespace points after the last real bar
  (per-preset counts/steps). Never add fake OHLC.
- Eraser: drag-to-erase stroke (one delete per drawing per stroke, topmost first), radius
  `DEFAULT_ERASER_RADIUS_PX = 6`.
- Migrations run on every repository read (`drawingMigration.migrateDrawing`): `4Y_1D→4Y_1W`, legacy
  `trendline`→`free_line`/`extended_trendline` (by extend flags), seconds→ms points
  (`normalizeDrawingPoint`, threshold 1e11), fills `showOnAllTimeframes`/`fillOpacity`, version → 3.
  Never lose stored drawings; unknown fields pass through.

### Long/Short position planning boxes (`LONG_POSITION`/`SHORT_POSITION`, C0101)
TradingView-style risk/reward planning boxes (`features/drawings/`). Stored as ordinary C0101 drawings
(same `ApiDrawingRepository`, same isolation by `C005Id`+`C010Id`+`C030Id`+`sourceTimeframe`) — they are
NOT C050 simulated entries. The `DrawingType` literal includes the two types on BOTH ends; backend
`DrawingStyle.position: dict | None` is an OPAQUE passthrough round-tripped via `EstiloJSON` (no schema
special-casing).
- **Canonical geometry = 3 points** (one coherent object, never independent points):
  `points[0]=entry (entryTime, entryPrice)`, `points[1]=target (endTime, targetPrice)`,
  `points[2]=stop (endTime, stopPrice)`. LONG: `target>entry>stop`; SHORT: `stop>entry>target`.
  Non-geometry data (quantity/fees/notes/accountCurrency/chartSlotId/range/interval/contextKey) lives in
  `style.position` (`PositionBoxData`), NOT in points.
- **Create**: ONE click (entry) + defaults (`positionBoxCalculations.defaultPositionPrices`: LONG
  target=entry·1.05/stop·0.97, SHORT target·0.95/stop·1.03; `endTime = entryTime +
  POSITION_DEFAULT_BARS(12)·stepMs`). Box is selected, tool returns to `cursor`. Timeframe-scoped
  (`showOnAllTimeframes=false`, `showOnTimeframes=[sourceTimeframe]`) — never leaks to other timeframes.
  `addDrawing` persists FIRST then adds to state; a failed POST surfaces an error toast (DEV shows the
  real status+detail) — never silent. `[PositionTool]` DEV logs trace toolbar→click→create→save.
- **Math**: pure `calcPositionBox` (riskPerShare/rewardPerShare, amounts, %, `riskRewardRatio`, P&L,
  breakeven; fees ADD to risk / SUBTRACT from reward). Never throws — invalid geometry/quantity → `{isValid:false, validationMessage}`.
- **Render** (`DrawingLayer` LONG/SHORT_POSITION case) uses `positionBoxLocal`, which is ROBUST: y from
  `priceToCoordinate` (always works), entry x from robust time, right-edge x from `endTime` OR a
  `POSITION_DEFAULT_WIDTH_PX(120)` fallback when `endTime` is future-unprojectable (box still renders far
  in the future). Green reward zone entry→target, red risk zone entry→stop, entry line + labels.
- **Handles & drag** (`positionBoxGeometry.ts`, pure, from a pointer-down snapshot — no drift): hit-test
  order for position boxes is price corner handles (entry/target/stop) → RIGHT_EDGE (center handle or
  anywhere on the right vertical border, `cursor:ew-resize`) → body. `dragPositionBoxPoints`: ENTRY drag
  shifts all three prices by the delta (preserves distances, keeps times); TARGET/STOP change ONLY their
  price, clamped to the valid side of entry. `resizePositionBoxRightEdge`: RIGHT_EDGE changes ONLY
  `endTime` (target+stop), prices/entryTime intact, clamped to a positive width. Body drag moves time+price
  together. `dragRef.mode` adds `"position_resize"`; handles render on the box's computed coords (not raw
  points) so they never misalign.
- **Edit/convert**: double-click → `PositionBoxModal` (`positionBoxStore` holds `editingId`): edit
  type/entry/target/stop/quantity/fees/notes with live calc; Save→`updateDrawing`, Delete, Lock, and
  **Crear entrada simulada** (optional → creates a C050 with `MetadataJSON.sourceDrawingC0101Id`; the
  C0101 plan is KEPT). Toolbar: `DrawingToolbar` L▲/S▼ buttons. AI Chat + ChatGPT contexts include a
  user-scoped `positionPlans` summary (toggle "Planes de posición").

### Indicators
Global configs live in `layoutStore.globalIndicators` (rich model: `params` + `style`, ids like
`sma-200`, `macd-12-26-9`; defaults/validation/normalization in `globalIndicators.ts`). Each panel
computes indicators from ITS OWN bars (RSI 14 on 4Y_1W = 14 weekly bars) — never share one calculation
across charts. Pure math lives in `indicatorCalculations.ts` (bar-based `calculate*` functions, ms
in/out); seconds conversion happens only in the `build*` functions. RSI is Wilder smoothing with
100/0/50 edge cases; MACD requires fast < slow (`validateIndicatorParams`).
- Price overlays include SMA, **EMA 9/20/50/200** (default colors: 9 yellow `#eab308`, 20 blue
  `#3b82f6`, 50 purple `#a855f7`, 200 red `#ef4444`), Bollinger and **VWAP** (`type:"VWAP"`, cyan
  `#06b6d4`). `buildPriceOverlays(allBars, visibleFromMs, indicators, intraday)` takes an `intraday`
  flag (true only for intraday intervals); VWAP is skipped (`continue`) when `!intraday` so it never
  draws on daily/weekly/monthly. EMA 200 with insufficient history yields `[]` (no fake values).
- `calculateVWAP(bars)` = cumulative Σ(typicalPrice·volume)/Σ(volume), typical `(h+l+c)/3`, **daily
  UTC session reset** (`Math.floor(time / 86_400_000)`); bars with zero/missing volume carry the
  previous VWAP when cumV>0 (else skip) — never divides by zero. AI/ChatGPT contexts add EMA
  20/50/200 (snapshot once; `ai_context_service._indicator_values`, `chatGptPromptService`).

### State & persistence
Zustand stores: `chartStore` (per-SLOT OHLCV + quote per symbol; legacy per-preset fields kept for
back-compat), `chartWorkspaceStore` (analysis workspaces; see that section), `symbolStore` (watchlist),
`drawingStore`, `layoutStore` (filters/colors/indicators, persisted as `tap.ui.v1`, version 3).
Components never touch localStorage directly — always via the repository classes. Critical zustand
detail: persist `migrate` only runs on version mismatch, so `layoutStore` also has a custom `merge`
that ALWAYS normalizes hydrated state (corrupt same-version state must not crash). All raw reads go
through `safeParseJson`. Error boundaries wrap the app (`main.tsx`) and each chart panel/mini-pane;
`resetLocalAppState` clears only the four `tap.*` keys.

### Testing conventions
Frontend vitest defaults to node env; DOM tests declare `// @vitest-environment jsdom` and need the
`ResizeObserver` stub (and `SVGElement.prototype.clientWidth` mocks for layout-dependent assertions —
see `DrawingLayer.crossTf.test.tsx`). `App.smoke.test.tsx` renders the real `<App/>` against clean,
legacy, and corrupt localStorage — keep it passing when changing persisted shapes; components using
router hooks (Header etc.) need a `MemoryRouter` wrapper. Auth tests live in
`features/auth/auth.test.tsx` (fetch mocked). Chart-mount paths (real LWC `createChart`) can't run in
jsdom; test logic through fake `ChartInstance` objects instead.
Backend tests monkeypatch `yahoo_service._download*` — no network — and use **SQLite in-memory** with
`schema_translate_map={"dbo": None}` + `create_all` (test DB only; see `app/tests/conftest.py`, which
also provides `make_user`/`login_headers`). Market tests bypass auth with an autouse fixture overriding
`get_current_active_user`. Never point tests at the real SQL Server.
