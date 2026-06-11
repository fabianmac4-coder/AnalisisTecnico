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
  indicator configs, `C030` layouts, `C040` user↔accion catalog, `C050` simulated/paper-trade
  entries, `C060` cached news, `C061` news↔accion links, `C062` market-mover snapshots, `C063`
  snapshot items, `C110` AI chat conversations, `C111` AI chat messages. Original tables have NO
  IDENTITY → new IDs come from `next_id()` (`repositories/sql_utils.py`, MAX+1); ONLY the new
  tables C006/C050/C060-C063/C110/C111 use IDENTITY.
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
  trending (from the SQL cache, never live calls) — prompts say not to invent news.
- Drawings are EDITABLE with the cursor tool: selecting a line makes the overlay interactive
  (pan/zoom pauses); drag the body (preserves slope) or an endpoint handle (10px radius), draft
  renders live and persists on pointer-up via `drawingStore.updateDrawing` (PATCH; rejects
  `Bloqueado=1` with 423 unless unlocking; `Version` is the MIGRATION version — never bump it as an
  edit counter). Escape cancels without persisting.
- Channel R/R is AUTO-detected by default (`channelAutoDetection.detectChannels`): pairs of
  ~parallel free_line/extended_trendline/dotted_line (slope tolerance 15%, ≥20% time overlap,
  width 1-40% of price, reference inside ±5%), upper/lower assigned by price at reference time,
  scored by overlap/inside/timeframe. The effective result is published in
  `channelRiskRewardStore.result` (manual override available, collapsed) and feeds the per-chart
  `ChannelRiskRewardBadge` (rendered in ChartCanvas) and both AI prompts (with `confidence`).
- Naming convention: physical SQL tables use CODE-ONLY names (`C110`, never `C110_ChatConversaciones`);
  PK/FK columns are exactly `CxxxId` (`C110Id`, `C005Id` — never `C005ID`, `UserId`, `usuario_id`).
  Descriptive names (C110-ChatConversaciones) exist only in documentation.
- `C005.NombreNormalizado` and `C010.TickerNormalizado` are **persisted computed columns**
  (`UPPER(TRIM(...))`): never write them; normalize lookups to UPPER instead (repos use
  `func.upper(func.trim(...))` so SQLite tests behave identically).
- Soft deletes only: users → `Activo=0` + `FechaDesactivacion`; drawings → `Eliminado=1`;
  catalog rows → `Activo=0`; AI conversations → `C110.Activo=0`. No physical DELETEs of user data,
  with ONE deliberate exception: `DELETE /api/admin/users/{id}/hard-delete` (purge test users:
  children first — C111 (via the user's C110 ids) → C110 → C050/C006/C0101/C020/C030/C040 — then
  C005, single transaction — `UsersRepository.hard_delete_user`; guards: not self, not the last
  active admin; frontend requires typing DELETE).

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
  `main.py`). Public: `/api/health`, `/api/health/db`, `/api/auth/login`,
  `/api/auth/validate-password-token`, `/api/auth/set-password`.
- Every data repo call is scoped by `C005Id` — a user must never see another user's rows; drawing
  updates go through `get_owned()`. Last-active-admin protections: cannot deactivate or de-admin the
  last active admin.
- `bcrypt` is pinned to 4.0.1 (passlib 1.7.4 compatibility); don't bump casually.

### Frontend auth wiring
- Routes in `main.tsx`: `/login`, `/forgot-password`, `/set-password`, `/reset-password`,
  `/account` (My Account: own profile + change password, every authenticated user),
  `/change-password` (forced change), `/admin/users` (AdminRoute), `/*` (ProtectedRoute → App).
  Token stored via `features/auth/authToken.ts` (`tap.auth.token.v1`) — a standalone module to
  avoid import cycles; `authStore` (zustand) holds user/session state.
- Separation of concerns: `/account` is personal (never lists other users); `/admin/users` is
  admin-only user management. Header shows 👤 Mi cuenta (`account-link`) for everyone and
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
  Markers render as dashed price lines via the optional `ChartInstance.setSimulatedEntryLines`
  (optional so fake ChartInstance objects in tests don't break). Watchlist removal NEVER touches C050.
- Channel R/R (`features/channelRiskReward/`) is FRONTEND-ONLY math over two user-selected
  `free_line` drawings: `getLinePriceAtTime` interpolates/extrapolates in **ms** (never LWC seconds);
  upper/lower swap automatically; reward<=0 / risk<=0 produce `invalidReason` instead of a ratio.
  The result is published in `channelRiskRewardStore` and flows into BOTH AI prompts: the ChatGPT
  prompt builder reads it at rebuild, and `aiChatStore.sendMessage` sends it as the optional
  `channelRiskReward` field (merged into the model context server-side). Both AI contexts also
  include `simulatedEntries`. Everything is labeled hypothetical — never investment advice.

### Timeframes are defined twice and must stay aligned
The six presets — `4Y_1W` (weekly!), `1Y_1D`, `6M_1D`, `3M_1D`, `1M_1H`, `1W_30M` — are defined in
`frontend/src/utils/timeframes.ts` AND `backend/app/timeframes.py` (same keys/intervals). Change both
or neither. `4Y_1D` is a legacy key that migrations rewrite to `4Y_1W`.

### Time units
Storage, API responses, and `DrawingPoint.time` are **Unix milliseconds UTC**. Lightweight Charts uses
**seconds** (`UTCTimestamp`). The only conversion source is
`frontend/src/features/drawings/timeConversion.ts` (`msToChartTime` / `chartTimeToMs`); `utils/dates.ts`
re-exports it. Convert at the chart boundary only — never store seconds.

### Canonical price (one price across all six charts)
The displayed "current price" (header, panel headers, sidebar, the dotted axis price line) comes ONLY
from `GET /api/market/quote` via `priceResolver.resolveDisplayPrice` (fallback order
`1W_30M → 1M_1H → 3M_1D → 6M_1D → 1Y_1D → 4Y_1W`, computed once per symbol). Every chart series is
created with `lastValueVisible:false, priceLineVisible:false`; the adapter draws a single canonical
price line (`setCanonicalPriceLine(price, change)` — color green/red/gray by `quote.change`, empty
title). Never derive a displayed price from a panel's last bar.

### Market data rules (backend `app/services/yahoo_service.py`)
- Raw prices only: `auto_adjust=False`, never Adj Close. All responses declare `priceBasis: "raw"`.
- One normalization path: `normalize_ohlcv_dataframe` (flattens MultiIndex, drops NaN rows, sorts, ms UTC).
- Cache keys: `ohlcv:SYMBOL:PRESET:interval:raw[:wN]` and `quote:SYMBOL` (separate caches; quote TTL 30s,
  OHLCV TTL 300s — see `app/config.py`, env prefix `TAP_`). `?forceRefresh=true` (quote/ohlcv) skips
  the cache READ but still writes the fresh result — used by the manual/auto refresh feature.
- Refresh feature (`frontend/src/features/refresh/`): `refreshNow` → `chartStore.refreshAllPresets`
  (NON-destructive: keeps old candles while loading and per-preset on failure; never clears charts)
  + reloads simulated-trade performance. Auto-refresh: radio-style 5/10/15/20 min (min 5 — Yahoo rate
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

### Indicators
Global configs live in `layoutStore.globalIndicators` (rich model: `params` + `style`, ids like
`sma-200`, `macd-12-26-9`; defaults/validation/normalization in `globalIndicators.ts`). Each panel
computes indicators from ITS OWN bars (RSI 14 on 4Y_1W = 14 weekly bars) — never share one calculation
across charts. Pure math lives in `indicatorCalculations.ts` (bar-based `calculate*` functions, ms
in/out); seconds conversion happens only in the `build*` functions. RSI is Wilder smoothing with
100/0/50 edge cases; MACD requires fast < slow (`validateIndicatorParams`).

### State & persistence
Zustand stores: `chartStore` (per-preset OHLCV + quote per symbol), `symbolStore` (watchlist),
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
