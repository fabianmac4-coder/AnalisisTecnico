# Estructura actual de la base de datos

- **Proyecto:** Terminal Financiero IA (Trading Analysis Platform / Sistema de Análisis Técnico Bolsa)
- **Base de datos:** `AnalisisTecnico` (SQL Server, esquema `dbo`)
- **Generado:** 2026-06-23T20:35:34-06:00
- **Fuente:** este documento describe la estructura **realmente implementada** en el
  repositorio: scripts SQL idempotentes (`backend/sql/*.sql`), modelos ORM
  SQLAlchemy (`backend/app/models/*.py`) y el código de borrado físico de usuario
  (`backend/app/repositories/users_repository.py`). No se inventan columnas.

> ⚠️ **Advertencia.** No hay Alembic ni un único `schema.sql` maestro: las tablas
> **originales** (`C005`, `C010`, `C0101`, `C020`, `C030`, `C040`) **pre-existen**
> en SQL Server y el repositorio solo las **altera** (agrega columnas/índices) y
> las **mapea** con el ORM. Para esas tablas, los tipos provienen del modelo ORM
> (`String(n)` se documenta como `VARCHAR(n)`, pero físicamente podría ser
> `NVARCHAR(n)`); confirma contra la base real con el script de introspección
> incluido (`estructura_base_datos_actual.sql`) si necesitas exactitud byte a byte.
> Las tablas **nuevas** (creadas por migración: `C006`, `C050`, `C060`–`C063`,
> `C080`, `C081`, `C090`, `C091`, `C092`, `C110`, `C111`) sí tienen su `CREATE
> TABLE` en el repo y se documentan con tipos exactos.

## Convenciones

- **Nombre físico** = código corto (`C005`, `C0101`, `C110`…). **Nombre
  documental** = código + descripción (`C005-Usuarios`).
- **PK/FK** se nombran exactamente `CxxxId` (`C005Id`, `C110Id`…). Nunca `Id`,
  `ID`, `UserId`, etc.
- **IDENTITY vs MAX+1.** Las tablas originales **no** usan `IDENTITY`; sus IDs se
  calculan con `MAX+1` (`repositories/sql_utils.next_id`). Las tablas nuevas
  (`C006`, `C050`, `C060`–`C063`, `C080`, `C081`, `C090`, `C091`, `C092`, `C110`,
  `C111`) usan `IDENTITY(1,1)`.
- **Null:** `S` = acepta NULL, `N` = NOT NULL.
- **Default:** se indica el `DEFAULT` físico cuando lo define una migración; en
  tablas pre-existentes que solo tienen default a nivel de aplicación se deja en
  blanco y se aclara en *Notas de uso*.
- **Columnas calculadas persistidas** (`NombreNormalizado`, `TickerNormalizado`,
  `URLHashKey`) nunca se escriben desde la app.

---

## C005 - Usuarios

### Propósito
Usuarios de la aplicación: identidad de autenticación, email, rol de
administrador, estado activo y bandera de cambio de contraseña.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C005Id | INT | N |  | PK (sin IDENTITY; MAX+1). |
| NombreUsuario | VARCHAR(200) | N |  | Nombre de usuario para login. |
| PasswordHash | VARCHAR(255) | N |  | Hash bcrypt de la contraseña. Nunca sale de la API. |
| Email | VARCHAR(200) | N |  | Email (NOT NULL en la tabla real). |
| Activo | BIT | N |  | Estado activo; `0` = desactivado (borrado suave). |
| FechaCreacion | DATETIME | N |  | Fecha de alta (la fija la app). |
| FechaActualizacion | DATETIME | N |  | Última modificación (la fija la app). |
| NombreNormalizado | VARCHAR(200) | S |  | **Calculada persistida** `UPPER(TRIM(NombreUsuario))`. No escribir. |
| EsAdmin | BIT | N | 0 | `1` = administrador. (migración 001) |
| DebeCambiarPassword | BIT | N | 1 | Fuerza cambio de contraseña en próximo login. (migración 001) |
| UltimoAcceso | DATETIME | S |  | Último login exitoso. (migración 001) |
| FechaDesactivacion | DATETIME | S |  | Momento de desactivación. (migración 001) |

### Llave primaria
- C005Id

### Llaves foráneas
- Ninguna

### Índices / constraints
- `UQ_C005_NombreNormalizado` UNIQUE sobre `NombreNormalizado`.
- `UQ_C005_Email` UNIQUE FILTRADO sobre `Email` (`WHERE Email IS NOT NULL`).

### Relaciones principales
Tabla raíz del aislamiento por usuario. Referenciada por `C006`, `C0101`, `C020`,
`C030`, `C040`, `C050`, `C081`, `C090`, `C091`, `C092`, `C110`.

### Notas de uso
- Sin registro público: los admins crean usuarios. `PasswordHash` jamás se expone.
- Borrado normal = suave (`Activo=0` + `FechaDesactivacion`). El hard-delete es la
  única excepción (ver sección "Orden de borrado físico de usuario").

---

## C006 - TokensPassword

### Propósito
Tokens de un solo uso para *set-password* (alta) y *reset-password* (recuperación).
Solo se guarda el **hash** del token; el token crudo viaja únicamente en el correo.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C006Id | INT IDENTITY(1,1) | N |  | PK. |
| C005Id | INT | N |  | FK al usuario dueño del token. |
| TokenHash | VARCHAR(255) | N |  | HMAC-SHA256 del token (nunca el token crudo). |
| TipoToken | VARCHAR(50) | N |  | `SET_PASSWORD` \| `RESET_PASSWORD`. |
| Usado | BIT | N | 0 | `1` cuando el token ya se consumió. |
| FechaExpiracion | DATETIME | N |  | Expira (SET=24h, RESET=1h). |
| FechaUso | DATETIME | S |  | Momento de uso. |
| FechaCreacion | DATETIME | N | GETDATE() | Fecha de emisión. |

### Llave primaria
- C006Id

### Llaves foráneas
- C005Id → C005(C005Id) — `FK_C006_C005`

### Índices / constraints
- `IX_C006_C005Id` sobre `C005Id`.
- `IX_C006_TokenHash` sobre `TokenHash`.

### Relaciones principales
Hija de `C005`. Tabla privada del usuario.

### Notas de uso
- Token de un solo uso; SET expira en 24h, RESET en 1h.

---

## C010 - Instrumentos (Acciones)

### Propósito
Catálogo maestro **compartido** de instrumentos (acciones/ETF/índices): ticker,
símbolo de Yahoo, exchange, moneda, país, sector, industria y zona horaria del
mercado.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C010Id | INT | N |  | PK (sin IDENTITY; MAX+1). |
| Ticker | VARCHAR(50) | N |  | Símbolo mostrado (ej. AAPL). |
| NombreInstrumento | VARCHAR(250) | S |  | Nombre de la empresa/instrumento. |
| TipoInstrumento | VARCHAR(50) | N |  | STOCK / ETF / INDEX / etc. |
| Exchange | VARCHAR(50) | S |  | Mercado/bolsa. |
| Moneda | VARCHAR(50) | S |  | Moneda de cotización. |
| Pais | VARCHAR(200) | S |  | País. |
| Sector | VARCHAR(200) | S |  | Sector. |
| Industria | VARCHAR(200) | S |  | Industria. |
| FuenteDatos | VARCHAR(200) | N |  | Proveedor de datos (ej. yahoo). |
| TimezoneMercado | VARCHAR(200) | S |  | Zona horaria del exchange (etiquetas de tiempo). |
| Activo | BIT | N |  | Estado activo. |
| FechaCreacion | DATETIME | N |  | Alta. |
| FechaActualizacion | DATETIME | N |  | Última actualización. |
| YahooSymbol | VARCHAR(50) | N |  | Símbolo para yfinance (NOT NULL en la tabla real). |
| TickerNormalizado | VARCHAR(50) | S |  | **Calculada persistida** `UPPER(TRIM(Ticker))`. No escribir. |

### Llave primaria
- C010Id

### Llaves foráneas
- Ninguna

### Índices / constraints
- `UQ_C010_TickerFuente` UNIQUE sobre `(TickerNormalizado, FuenteDatos)`.

### Relaciones principales
Catálogo compartido entre usuarios. Referenciado por `C0101`, `C020`, `C030`,
`C040`, `C050`, `C061`, `C063`, `C091`, `C110`.

### Notas de uso
- **Compartida**: no se acota por `C005Id`. Quitar un ticker del watchlist NUNCA
  borra la fila maestra de `C010`.

---

## C0101 - AnalisisDibujos

### Propósito
Dibujos de análisis sobre las gráficas (líneas, segmentos, *extended trendline*,
y cajas de planificación Long/Short Position), por usuario + acción + workspace.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C0101Id | INT | N |  | PK (sin IDENTITY; MAX+1). |
| C005Id | INT | N |  | FK al usuario dueño. |
| C010Id | INT | N |  | FK a la acción. |
| C030Id | INT | S |  | FK al workspace (NULL = dibujo heredado pre-workspaces). (migración 010) |
| TipoDibujo | VARCHAR(50) | N |  | free_line / extended_trendline / LONG_POSITION / SHORT_POSITION / etc. |
| TemporalidadOrigen | VARCHAR(50) | N |  | Temporalidad de origen / contextKey del dibujo. |
| NombreAnalisis | VARCHAR(200) | S |  | Nombre opcional del análisis. |
| PuntosJSON | NVARCHAR(MAX) | N |  | Puntos `{time(ms), price}` en JSON. |
| EstiloJSON | NVARCHAR(MAX) | N |  | Estilo (color, ancho) y `position` opaco de cajas Long/Short. |
| Visible | BIT | N |  | Visibilidad. |
| Bloqueado | BIT | N |  | Bloqueado (no editable; PATCH responde 423). |
| MostrarEnTodasTemporalidades | BIT | N |  | Visible en las seis gráficas. |
| TemporalidadesVisiblesJSON | NVARCHAR(MAX) | S |  | Lista de temporalidades donde se muestra. |
| Comentario | VARCHAR(500) | S |  | Comentario libre. |
| Version | INT | N |  | Versión de migración del esquema del dibujo (no contador de edición). |
| FechaCreacion | DATETIME | N |  | Alta. |
| FechaActualizacion | DATETIME | N |  | Última edición. |
| Eliminado | BIT | N |  | Borrado suave (`Eliminado=1`). |

### Llave primaria
- C0101Id

### Llaves foráneas
- C005Id → C005(C005Id)
- C010Id → C010(C010Id)
- C030Id → C030(C030Id) — `FK_C0101_C030` (migración 010)

### Índices / constraints
- `IX_C0101_C005Id_C010Id_C030Id` sobre `(C005Id, C010Id, C030Id)`.
- `IX_C0101_C005Id_C010Id_C030Id_TemporalidadOrigen` sobre `(C005Id, C010Id, C030Id, TemporalidadOrigen)`.

### Relaciones principales
Hija de `C005`, `C010` y `C030`. Tabla privada del usuario.

### Notas de uso
- Aislada por workspace (`C030Id`). Borrado = suave (`Eliminado=1`). Las cajas
  Long/Short Position se guardan aquí (no en `C050`).

---

## C020 - IndicadoresConfiguracion

### Propósito
Configuración de indicadores del usuario (RSI, MACD, EMA, VWAP, Bollinger, SMA,
Volumen): visibilidad, parámetros y estilo. `C010Id` NULL = configuración global
del usuario; con valor = por instrumento.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C020Id | INT | N |  | PK (sin IDENTITY; MAX+1). |
| C005Id | INT | N |  | FK al usuario dueño. |
| C010Id | INT | S |  | FK a la acción (NULL = config global del usuario). |
| TipoIndicador | VARCHAR(50) | N |  | SMA / EMA / VWAP / RSI / MACD / BBANDS / VOLUME. |
| NombreIndicador | VARCHAR(200) | N |  | Nombre/etiqueta del indicador. |
| Visible | BIT | N |  | Activo/visible. |
| AplicarTodasTemporalidades | BIT | N |  | Aplica a las seis gráficas. |
| ParametrosJSON | NVARCHAR(MAX) | N |  | Parámetros (periodo, fuente, etc.) en JSON. |
| EstiloJSON | NVARCHAR(MAX) | S |  | Estilo (colores, ancho) en JSON. |
| FechaCreacion | DATETIME | N |  | Alta. |
| FechaActualizacion | DATETIME | N |  | Última actualización. |

### Llave primaria
- C020Id

### Llaves foráneas
- C005Id → C005(C005Id)
- C010Id → C010(C010Id) (nullable)

### Índices / constraints
- Sin índices declarados en migración (tabla pre-existente). Confirmar en la base real.

### Relaciones principales
Hija de `C005` y (opcional) `C010`. Tabla privada del usuario.

### Notas de uso
- Sincronización con el frontend vía `indicatorSync` (GET al montar, PUT debounced).

---

## C030 - LayoutsGraficas

### Propósito
Workspaces/layouts de análisis por usuario y acción. Cada fila es **un workspace**
con seis paneles de gráfica (rango/intervalo/configuración) en `ConfiguracionJSON`.
`C010Id` NULL = layout global heredado; con valor = workspace por acción.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C030Id | INT | N |  | PK (sin IDENTITY; MAX+1). |
| C005Id | INT | N |  | FK al usuario dueño. |
| C010Id | INT | S |  | FK a la acción (NULL = layout global heredado). (migración 009) |
| NombreLayout | VARCHAR(200) | N |  | Nombre del workspace. |
| EsDefault | BIT | N |  | Workspace por defecto de la acción. |
| ConfiguracionJSON | NVARCHAR(MAX) | N |  | Seis slots `{slotId,range,interval}` + ajustes, en JSON. |
| Activo | BIT | N | 1 | Borrado suave (`Activo=0`). (migración 009) |
| FechaCreacion | DATETIME | N |  | Alta. |
| FechaActualizacion | DATETIME | N |  | Última actualización. |

### Llave primaria
- C030Id

### Llaves foráneas
- C005Id → C005(C005Id)
- C010Id → C010(C010Id) — `FK_C030_C010` (migración 009)

### Índices / constraints
- `IX_C030_C005Id_C010Id` sobre `(C005Id, C010Id)`.

### Relaciones principales
Hija de `C005` y (opcional) `C010`. Padre de `C0101` y `C050` (vía `C030Id`).
Tabla privada del usuario.

### Notas de uso
- `get_default_by_user` filtra `C010Id IS NULL` para el layout global. No se puede
  borrar el último workspace de una acción (409). Borrar un workspace nunca toca
  dibujos/indicadores/operaciones/IA.

---

## C040 - CatalogoUsuarioAcciones

### Propósito
Watchlist / instrumentos seguidos por el usuario: favoritos, etiquetas, notas y
última consulta. Único por `(C005Id, C010Id)`.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C040Id | INT | N |  | PK (sin IDENTITY; MAX+1). |
| C005Id | INT | N |  | FK al usuario dueño. |
| C010Id | INT | N |  | FK a la acción seguida. |
| Favorito | BIT | N |  | Marca de favorito (★). |
| TagsJSON | NVARCHAR(MAX) | S |  | Etiquetas en JSON. |
| UltimaConsulta | DATETIME | S |  | Última vez que se abrió. |
| Notas | VARCHAR(500) | S |  | Notas del usuario. |
| Activo | BIT | N |  | Borrado suave (`Activo=0`). |
| FechaCreacion | DATETIME | N |  | Alta. |
| FechaActualizacion | DATETIME | N |  | Última actualización. |

### Llave primaria
- C040Id

### Llaves foráneas
- C005Id → C005(C005Id)
- C010Id → C010(C010Id)

### Índices / constraints
- `UQ_C040_UsuarioAccion` UNIQUE sobre `(C005Id, C010Id)`. (migración 001)

### Relaciones principales
Hija de `C005` y `C010`. Tabla privada del usuario.

### Notas de uso
- Quitar del watchlist = `Activo=0` solo del usuario actual; nunca borra `C010`
  ni dibujos/indicadores/operaciones.

---

## C050 - OperacionesSimuladas

### Propósito
Entradas simuladas / *paper trading* por usuario + acción (LONG/SHORT,
ABIERTA/CERRADA), con snapshot de análisis al crear. **No** es ejecución real de
órdenes.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C050Id | INT IDENTITY(1,1) | N |  | PK. |
| C005Id | INT | N |  | FK al usuario dueño. |
| C010Id | INT | N |  | FK a la acción. |
| C030Id | INT | S |  | FK al workspace activo al crear (NULL = heredada). (migración 012) |
| TipoOperacion | VARCHAR(30) | N |  | LONG \| SHORT. |
| PrecioEntrada | DECIMAL(18,6) | N |  | Precio de entrada. |
| Cantidad | DECIMAL(18,6) | S |  | Cantidad hipotética. |
| FechaEntrada | DATETIME | N |  | Momento de entrada. |
| TemporalidadOrigen | VARCHAR(30) | S |  | Temporalidad de origen. |
| NombreOperacion | VARCHAR(200) | S |  | Nombre opcional. |
| Notas | VARCHAR(1000) | S |  | Notas. |
| Estado | VARCHAR(30) | N |  | ABIERTA \| CERRADA. |
| PrecioSalida | DECIMAL(18,6) | S |  | Precio de salida (al cerrar). |
| FechaSalida | DATETIME | S |  | Fecha de cierre. |
| MotivoSalida | VARCHAR(500) | S |  | Motivo del cierre. |
| Color | VARCHAR(30) | S |  | Color del marcador. |
| Visible | BIT | N | 1 | Visibilidad en la gráfica. |
| Activo | BIT | N | 1 | Borrado suave (`Activo=0 AND Visible=0`). |
| MetadataJSON | NVARCHAR(MAX) | S |  | Contexto de clic/vela/gráfica al crear. (migración 012) |
| AnalisisJSON | NVARCHAR(MAX) | S |  | Snapshot scorecard/técnico/canal R/R/tesis. (migración 012) |
| FechaCreacion | DATETIME | N | GETDATE() | Alta. |
| FechaActualizacion | DATETIME | N | GETDATE() | Última actualización. |

### Llave primaria
- C050Id

### Llaves foráneas
- C005Id → C005(C005Id) — `FK_C050_C005`
- C010Id → C010(C010Id) — `FK_C050_C010`
- C030Id → C030(C030Id) — `FK_C050_C030` (migración 012)

### Índices / constraints
- `IX_C050_C005Id_C010Id` sobre `(C005Id, C010Id)`.
- `IX_C050_C005Id_C010Id_Estado` sobre `(C005Id, C010Id, Estado)`.
- `IX_C050_C005Id_C010Id_C030Id` sobre `(C005Id, C010Id, C030Id)`. (migración 012)

### Relaciones principales
Hija de `C005`, `C010` y (opcional) `C030`. Tabla privada del usuario.

### Notas de uso
- Las cajas de planificación Long/Short Position son dibujos (`C0101`), no `C050`.

---

## C060 - Noticias

### Propósito
Cache **compartido** de noticias financieras de proveedores externos (Yahoo,
Google News). No almacena datos de usuario.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C060Id | INT IDENTITY(1,1) | N |  | PK. |
| Proveedor | VARCHAR(50) | N |  | Proveedor (yahoo / google). |
| ExternalId | VARCHAR(255) | S |  | Id externo del proveedor. |
| Titulo | NVARCHAR(500) | N |  | Titular. |
| Resumen | NVARCHAR(MAX) | S |  | Resumen. |
| URL | NVARCHAR(1000) | N |  | URL de la noticia. |
| Publisher | VARCHAR(250) | S |  | Editor/medio. |
| ImagenURL | NVARCHAR(1000) | S |  | URL de imagen. |
| Categoria | VARCHAR(100) | S |  | Categoría (clasificador por palabras clave). |
| Idioma | VARCHAR(20) | S |  | Idioma. |
| Pais | VARCHAR(50) | S |  | País. |
| FechaPublicacion | DATETIME | S |  | Fecha de publicación. |
| FechaObtencion | DATETIME | N | GETDATE() | Fecha de captura en el cache. |
| RawJSON | NVARCHAR(MAX) | S |  | Payload crudo del proveedor. |
| Activo | BIT | N | 1 | Activo en cache. |
| URLHashKey | VARBINARY(32) | S |  | **Calculada persistida** `HASHBYTES('SHA2_256', URL)`; indexa URLs largas. No mapeada en el ORM. |

### Llave primaria
- C060Id

### Llaves foráneas
- Ninguna

### Índices / constraints
- `IX_C060_Proveedor`, `IX_C060_FechaPublicacion`, `IX_C060_Categoria`.
- `IX_C060_URL` sobre `URLHashKey`.

### Relaciones principales
Compartida. Padre de `C061`.

### Notas de uso
- Compartida entre usuarios; TTL corto. Dedupe por URL normalizada y luego
  `(Proveedor, ExternalId)`.

---

## C061 - NoticiasInstrumentos

### Propósito
Relación N:M entre noticias (`C060`) e instrumentos (`C010`), con score de
relevancia por símbolo.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C061Id | INT IDENTITY(1,1) | N |  | PK. |
| C060Id | INT | N |  | FK a la noticia. |
| C010Id | INT | N |  | FK al instrumento. |
| Relevancia | DECIMAL(10,4) | S |  | Score de relevancia símbolo↔noticia. |
| FechaCreacion | DATETIME | N | GETDATE() | Alta del enlace. |

### Llave primaria
- C061Id

### Llaves foráneas
- C060Id → C060(C060Id) — `FK_C061_C060`
- C010Id → C010(C010Id) — `FK_C061_C010`

### Índices / constraints
- `IX_C061_C060Id`, `IX_C061_C010Id`, `IX_C061_C010Id_C060Id`.

### Relaciones principales
Hija de `C060` y `C010`. Compartida (no acotada por usuario).

### Notas de uso
- Enlaces creados solo sobre el umbral de relevancia (estricto por símbolo).

---

## C062 - ListasMercado

### Propósito
Snapshots **compartidos** de listas de market movers (trending, gainers, losers,
most active).

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C062Id | INT IDENTITY(1,1) | N |  | PK. |
| TipoLista | VARCHAR(50) | N |  | TRENDING \| TOP_GAINERS \| TOP_LOSERS \| MOST_ACTIVE. |
| Proveedor | VARCHAR(50) | N |  | Proveedor (yahoo). |
| FechaObtencion | DATETIME | N | GETDATE() | Fecha del snapshot. |
| RawJSON | NVARCHAR(MAX) | S |  | Payload crudo. |
| Activo | BIT | N | 1 | Activo en cache. |

### Llave primaria
- C062Id

### Llaves foráneas
- Ninguna

### Índices / constraints
- `IX_C062_TipoLista`, `IX_C062_TipoLista_FechaObtencion`.

### Relaciones principales
Compartida. Padre de `C063`.

### Notas de uso
- Cache con TTL corto; compartido entre usuarios.

---

## C063 - ListasMercadoDetalle

### Propósito
Filas de detalle (instrumentos) de cada snapshot de `C062`.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C063Id | INT IDENTITY(1,1) | N |  | PK. |
| C062Id | INT | N |  | FK al snapshot. |
| C010Id | INT | S |  | FK al instrumento (si es conocido). |
| Ticker | VARCHAR(30) | N |  | Ticker. |
| YahooSymbol | VARCHAR(50) | S |  | Símbolo Yahoo. |
| NombreInstrumento | VARCHAR(250) | S |  | Nombre. |
| Precio | DECIMAL(18,6) | S |  | Precio. |
| Cambio | DECIMAL(18,6) | S |  | Cambio. |
| CambioPorcentaje | DECIMAL(18,6) | S |  | Cambio %. |
| Volumen | BIGINT | S |  | Volumen. |
| MarketCap | DECIMAL(28,2) | S |  | Capitalización. |
| Ranking | INT | S |  | Posición en la lista. |
| RawJSON | NVARCHAR(MAX) | S |  | Payload crudo de la fila. |
| FechaCreacion | DATETIME | N | GETDATE() | Alta. |

### Llave primaria
- C063Id

### Llaves foráneas
- C062Id → C062(C062Id) — `FK_C063_C062`
- C010Id → C010(C010Id) — `FK_C063_C010` (nullable)

### Índices / constraints
- `IX_C063_C062Id`, `IX_C063_Ticker`, `IX_C063_C010Id`.

### Relaciones principales
Hija de `C062` y (opcional) `C010`. Compartida.

### Notas de uso
- Compartida; se borra/recrea con cada refresh del snapshot.

---

## C080 - MacroMarketCache

### Propósito
Cache **compartido** de Inteligencia de Mercado, sentimiento, macro y respuestas
de proveedores externos (clave/valor JSON con TTL). No almacena datos de usuario
ni secretos.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C080Id | INT IDENTITY(1,1) | N |  | PK. |
| TipoDato | VARCHAR(100) | N |  | MARKET_INTELLIGENCE_OVERVIEW / MARKET_SENTIMENT / MACRO_OVERVIEW / FRED_RELEASE_IDS / etc. |
| Proveedor | VARCHAR(100) | N |  | Proveedor/origen. |
| Clave | VARCHAR(200) | N |  | Clave del cache. |
| DataJSON | NVARCHAR(MAX) | N |  | Payload del cache. |
| FechaObtencion | DATETIME | N | GETDATE() | Fecha de captura. |
| FechaExpiracion | DATETIME | N |  | Expiración (TTL). |
| Activo | BIT | N | 1 | Fila activa (`store()` desactiva las previas de la misma clave). |

### Llave primaria
- C080Id

### Llaves foráneas
- Ninguna

### Índices / constraints
- `IX_C080_TipoDato`, `IX_C080_Clave`, `IX_C080_FechaExpiracion`.

### Relaciones principales
Independiente, compartida entre usuarios.

### Notas de uso
- `get_fresh` lee la activa no expirada; `get_latest_any` la última aunque expire.

---

## C081 - ConfiguracionScorecard

### Propósito
Configuración del Stock Scorecard por usuario (perfiles: pesos + umbrales) en
`ConfiguracionJSON`. Varios perfiles por usuario; uno marcado por defecto.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C081Id | INT IDENTITY(1,1) | N |  | PK. |
| C005Id | INT | N |  | FK al usuario dueño. |
| NombreConfiguracion | VARCHAR(200) | N |  | Nombre del perfil. |
| EsDefault | BIT | N | 0 | Perfil por defecto del usuario. |
| ConfiguracionJSON | NVARCHAR(MAX) | N |  | Pesos + umbrales en JSON. |
| Activo | BIT | N | 1 | Borrado suave. |
| FechaCreacion | DATETIME | N | GETDATE() | Alta. |
| FechaActualizacion | DATETIME | N | GETDATE() | Última actualización. |

### Llave primaria
- C081Id

### Llaves foráneas
- C005Id → C005(C005Id) — `FK_C081_C005`

### Índices / constraints
- `IX_C081_C005Id` sobre `C005Id`.

### Relaciones principales
Hija de `C005`. Tabla privada del usuario.

### Notas de uso
- Validación: pesos numéricos ≥ 0 y total = 100 (si no, `422`).

---

## C090 - Portafolios

### Propósito
Portafolios de inversión del usuario (tenencias con cantidad/costo, separado del
watchlist).

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C090Id | INT IDENTITY(1,1) | N |  | PK. |
| C005Id | INT | N |  | FK al usuario dueño. |
| NombrePortafolio | VARCHAR(200) | N |  | Nombre del portafolio. |
| Descripcion | VARCHAR(1000) | S |  | Descripción. |
| MonedaBase | VARCHAR(10) | N | 'USD' | Moneda base. |
| EsDefault | BIT | N | 0 | Portafolio por defecto. |
| Activo | BIT | N | 1 | Borrado suave. |
| FechaCreacion | DATETIME | N | GETDATE() | Alta. |
| FechaActualizacion | DATETIME | N | GETDATE() | Última actualización. |

### Llave primaria
- C090Id

### Llaves foráneas
- C005Id → C005(C005Id) — `FK_C090_C005`

### Índices / constraints
- `IX_C090_C005Id`, `IX_C090_C005Id_Activo`, `IX_C090_C005Id_EsDefault`.

### Relaciones principales
Hija de `C005`. Padre de `C091`. Tabla privada del usuario.

### Notas de uso
- Borrar un portafolio desactiva sus posiciones (`C091`).

---

## C091 - PosicionesPortafolio

### Propósito
Posiciones/holdings dentro de un portafolio. Guarda `C005Id` (además de `C090Id`)
para acotar por usuario sin join.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C091Id | INT IDENTITY(1,1) | N |  | PK. |
| C090Id | INT | N |  | FK al portafolio. |
| C005Id | INT | N |  | FK al usuario dueño (denormalizado para aislar sin join). |
| C010Id | INT | S |  | FK al instrumento (si es conocido). |
| Ticker | VARCHAR(30) | N |  | Ticker. |
| YahooSymbol | VARCHAR(50) | S |  | Símbolo Yahoo. |
| NombreInstrumento | VARCHAR(250) | S |  | Nombre. |
| TipoInstrumento | VARCHAR(50) | N | 'STOCK' | Tipo de instrumento. |
| Cantidad | DECIMAL(18,6) | N |  | Cantidad (> 0). |
| PrecioCompraPromedio | DECIMAL(18,6) | N |  | Costo promedio (≥ 0). |
| FechaCompra | DATETIME | S |  | Fecha de compra. |
| Moneda | VARCHAR(10) | S |  | Moneda. |
| Sector | VARCHAR(150) | S |  | Sector. |
| Industria | VARCHAR(150) | S |  | Industria. |
| Notas | VARCHAR(1000) | S |  | Notas. |
| Activo | BIT | N | 1 | Borrado suave. |
| FechaCreacion | DATETIME | N | GETDATE() | Alta. |
| FechaActualizacion | DATETIME | N | GETDATE() | Última actualización. |

### Llave primaria
- C091Id

### Llaves foráneas
- C090Id → C090(C090Id) — `FK_C091_C090`
- C005Id → C005(C005Id) — `FK_C091_C005`
- C010Id → C010(C010Id) — `FK_C091_C010` (nullable)

### Índices / constraints
- `IX_C091_C090Id`, `IX_C091_C005Id`, `IX_C091_C090Id_Activo`,
  `IX_C091_C090Id_Ticker`, `IX_C091_C010Id`.

### Relaciones principales
Hija de `C090`, `C005` y (opcional) `C010`. Tabla privada del usuario.

### Notas de uso
- En el hard-delete se borra **antes** que `C090` por la FK.

---

## C092 - PreferenciasUsuario

### Propósito
Preferencias clave/valor por usuario. Primer uso: `DEFAULT_CHART_LAYOUT_TEMPLATE`
(plantilla de las seis gráficas aplicada a stocks/workspaces nuevos).

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C092Id | INT IDENTITY(1,1) | N |  | PK. |
| C005Id | INT | N |  | FK al usuario dueño. |
| ClavePreferencia | VARCHAR(100) | N |  | Clave (ej. DEFAULT_CHART_LAYOUT_TEMPLATE). |
| ValorJSON | NVARCHAR(MAX) | N |  | Valor en JSON. |
| Activo | BIT | N | 1 | Borrado suave (reset al default del sistema). |
| FechaCreacion | DATETIME | N | GETDATE() | Alta. |
| FechaActualizacion | DATETIME | N | GETDATE() | Última actualización. |

### Llave primaria
- C092Id

### Llaves foráneas
- C005Id → C005(C005Id) — `FK_C092_C005`

### Índices / constraints
- `IX_C092_C005Id` sobre `C005Id`.
- `UX_C092_C005Id_Clave_Activo` UNIQUE FILTRADO sobre `(C005Id, ClavePreferencia)`
  `WHERE Activo = 1` (una sola preferencia activa por usuario + clave).

### Relaciones principales
Hija de `C005`. Tabla privada del usuario.

### Notas de uso
- Implementada (migración 015). El hard-delete borra sus filas.

---

## C110 - ChatConversaciones

### Propósito
Conversaciones del AI Chat por usuario y (opcional) acción/contexto de ticker.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C110Id | INT IDENTITY(1,1) | N |  | PK. |
| C005Id | INT | N |  | FK al usuario dueño. |
| C010Id | INT | S |  | FK a la acción (contexto, opcional). |
| TituloConversacion | VARCHAR(250) | S |  | Título. |
| ContextoTicker | VARCHAR(30) | S |  | Ticker de contexto. |
| ContextoYahooSymbol | VARCHAR(50) | S |  | Símbolo Yahoo de contexto. |
| Modelo | VARCHAR(100) | N |  | Modelo de IA usado. |
| Activo | BIT | N | 1 | Borrado suave (`Activo=0`). |
| FechaCreacion | DATETIME | N | GETDATE() | Alta. |
| FechaActualizacion | DATETIME | N | GETDATE() | Última actualización. |

### Llave primaria
- C110Id

### Llaves foráneas
- C005Id → C005(C005Id) — `FK_C110_C005`
- C010Id → C010(C010Id) — `FK_C110_C010` (nullable)

### Índices / constraints
- `IX_C110_C005Id`, `IX_C110_C010Id`, `IX_C110_C005Id_C010Id`.

### Relaciones principales
Hija de `C005` y (opcional) `C010`. Padre de `C111`. Tabla privada del usuario.

### Notas de uso
- Ownership verificado en cada lectura/escritura; acceso cruzado = 404.

---

## C111 - ChatMensajes

### Propósito
Mensajes dentro de cada conversación de AI Chat.

### Columnas
| Campo | Tipo de dato | Null | Default | Descripción |
| --- | --- | :--: | --- | --- |
| C111Id | INT IDENTITY(1,1) | N |  | PK. |
| C110Id | INT | N |  | FK a la conversación. |
| Rol | VARCHAR(30) | N |  | system \| user \| assistant \| tool. |
| Contenido | NVARCHAR(MAX) | N |  | Texto del mensaje. |
| MetadataJSON | NVARCHAR(MAX) | S |  | Metadatos opcionales. |
| TokensEntrada | INT | S |  | Tokens de entrada. |
| TokensSalida | INT | S |  | Tokens de salida. |
| FechaCreacion | DATETIME | N | GETDATE() | Alta. |

### Llave primaria
- C111Id

### Llaves foráneas
- C110Id → C110(C110Id) — `FK_C111_C110`

### Índices / constraints
- `IX_C111_C110Id`, `IX_C111_C110Id_FechaCreacion`.

### Relaciones principales
Hija de `C110`. Privada del usuario **a través de** `C110` (no tiene `C005Id`).

### Notas de uso
- En el hard-delete se borra **primero**, vía subconsulta de los `C110Id` del usuario.

---

# Resumen de relaciones

```
C005 Usuarios
├── C006 TokensPassword
├── C0101 AnalisisDibujos        (también → C010, C030)
├── C020 IndicadoresConfiguracion (también → C010 opcional)
├── C030 LayoutsGraficas          (también → C010 opcional)
│   ├── C0101 AnalisisDibujos     (C030Id)
│   └── C050 OperacionesSimuladas (C030Id)
├── C040 CatalogoUsuarioAcciones  (también → C010)
├── C050 OperacionesSimuladas     (también → C010, C030)
├── C081 ConfiguracionScorecard
├── C090 Portafolios
│   └── C091 PosicionesPortafolio (también → C005, C010)
├── C092 PreferenciasUsuario
└── C110 ChatConversaciones       (también → C010 opcional)
    └── C111 ChatMensajes

C010 Instrumentos (catálogo compartido)
├── C0101 AnalisisDibujos
├── C020 IndicadoresConfiguracion
├── C030 LayoutsGraficas
├── C040 CatalogoUsuarioAcciones
├── C050 OperacionesSimuladas
├── C061 NoticiasInstrumentos
├── C063 ListasMercadoDetalle
├── C091 PosicionesPortafolio
└── C110 ChatConversaciones

C060 Noticias (compartida)
└── C061 NoticiasInstrumentos (→ C010)

C062 ListasMercado (compartida)
└── C063 ListasMercadoDetalle (→ C010 opcional)

C080 MacroMarketCache (compartida, independiente)
```

---

# Reglas de seguridad y aislamiento por usuario

- **Tablas privadas**: toda lectura/escritura se acota por `C005Id`. Un usuario A
  **nunca** debe leer/escribir filas del usuario B. Las actualizaciones de dibujos
  pasan por `get_owned()`.
- **Tablas compartidas** (catálogo/cache): pueden compartirse entre usuarios; no
  llevan `C005Id`.
- `C010` es catálogo compartido.
- `C060`/`C061`/`C062`/`C063` (noticias/movers) son cache compartido.
- `C080` (macro/inteligencia de mercado) es cache compartido.
- El borrado físico de un usuario (`C005`) debe eliminar **primero** sus filas
  hijas privadas (ver siguiente sección).

### Tablas privadas (acotadas por `C005Id`)
- C006
- C0101
- C020
- C030
- C040
- C050
- C081
- C090
- C091
- C092
- C110
- C111 (a través de `C110`; no tiene `C005Id` propio)

### Tablas compartidas / cache
- C010 (catálogo maestro)
- C060 (noticias)
- C061 (enlaces noticia↔instrumento)
- C062 (snapshots de movers)
- C063 (detalle de movers)
- C080 (macro / inteligencia de mercado)

---

# Orden de borrado físico de usuario

Implementado en `UsersRepository.hard_delete_user`
(`backend/app/repositories/users_repository.py`). Una sola transacción; el orden
respeta las FKs (hijos antes que padres; `C091` antes que `C090`; `C111` antes que
`C110`). **No** toca tablas compartidas/cache (`C010`, `C060`–`C063`, `C080`).

1. `C111` — `DELETE WHERE C110Id IN (SELECT C110Id FROM C110 WHERE C005Id = @user)`
2. `C110` — `WHERE C005Id = @user`
3. `C081` — `WHERE C005Id = @user`
4. `C092` — `WHERE C005Id = @user`
5. `C091` — `WHERE C005Id = @user`
6. `C090` — `WHERE C005Id = @user`
7. `C050` — `WHERE C005Id = @user`
8. `C006` — `WHERE C005Id = @user`
9. `C0101` — `WHERE C005Id = @user`
10. `C020` — `WHERE C005Id = @user`
11. `C030` — `WHERE C005Id = @user`
12. `C040` — `WHERE C005Id = @user`
13. `C005` — borra el usuario

> El orden implementado coincide con el orden esperado. Guardas: no permite borrar
> al propio usuario ni al último administrador activo; en el frontend exige escribir
> "DELETE". Es la **única** excepción a la regla de solo borrado suave.

---

# Tablas removidas / deprecadas

- **C070, C071, C072, C073 — módulo ROIC.ai** (cache de fundamentales, historial
  de análisis, templates de prompts y log de requests). **Eliminadas** por la
  migración `008_remove_roic_module.sql` (DROP de FKs + DROP TABLE, hijos antes que
  padres). El scorecard ya no usa ROIC.ai; usa solo Yahoo. No deben existir en una
  base actualizada y no se mapean en el ORM.

---

# Notas finales

- **Migraciones:** `backend/sql/001…015` (idempotentes, ejecutadas por
  `scripts/run_migrations.py`). No hay numeración 003 ni 007 (saltos
  intencionales en la historia del proyecto).
- **Tipos en tablas pre-existentes** (`C005` originales, `C010`, `C0101`, `C020`,
  `C030`, `C040`): documentados según el mapeo del ORM; el tipo físico exacto
  (`VARCHAR` vs `NVARCHAR`, longitudes) debe confirmarse con el script de
  introspección.
- **`DATETIME`**: el código maneja tiempos en UTC; las marcas de las velas/dibujos
  se guardan en Unix ms UTC dentro de los JSON, no como columnas `DATETIME`.
