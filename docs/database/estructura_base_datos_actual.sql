/* ============================================================================
   Estructura actual de la base de datos - AnalisisTecnico (SQL Server, dbo)
   Proyecto: Terminal Financiero IA (Trading Analysis Platform)
   Generado: 2026-06-23T20:35:34-06:00

   Este archivo tiene DOS partes:
     A) CREATE TABLE reconstruidos LITERALMENTE desde las migraciones del repo
        (tablas NUEVAS: C006, C050, C060-C063, C080, C081, C090, C091, C092,
        C110, C111). Son fieles a backend/sql/*.sql.
     B) ALTER de referencia sobre las tablas PRE-EXISTENTES (C005, C010, C0101,
        C020, C030, C040): su CREATE TABLE original NO esta en el repo (las
        tablas ya existian en SQL Server). Para esas tablas, ejecuta el SCRIPT
        DE INTROSPECCION (Parte C) contra la base real para obtener el DDL exacto.
     C) Script de introspeccion (columnas, PKs, FKs, indices) para exportar el
        esquema REAL desde SQL Server.

   NOTA: las tablas del modulo ROIC.ai (C070-C073) fueron ELIMINADAS por la
   migracion 008 y NO se incluyen aqui.
   ============================================================================ */


/* ============================================================================
   PARTE A - CREATE TABLE reconstruidos desde migraciones (tablas nuevas)
   ============================================================================ */

-- C006-TokensPassword (migracion 002)
CREATE TABLE dbo.C006 (
    C006Id INT IDENTITY(1,1) PRIMARY KEY,
    C005Id INT NOT NULL,
    TokenHash VARCHAR(255) NOT NULL,
    TipoToken VARCHAR(50) NOT NULL,
    Usado BIT NOT NULL CONSTRAINT DF_C006_Usado DEFAULT 0,
    FechaExpiracion DATETIME NOT NULL,
    FechaUso DATETIME NULL,
    FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C006_FechaCreacion DEFAULT GETDATE(),
    CONSTRAINT FK_C006_C005 FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id)
);
CREATE INDEX IX_C006_C005Id ON dbo.C006(C005Id);
CREATE INDEX IX_C006_TokenHash ON dbo.C006(TokenHash);
GO

-- C050-OperacionesSimuladas (migracion 005 + columnas de migracion 012)
CREATE TABLE dbo.C050 (
    C050Id INT IDENTITY(1,1) PRIMARY KEY,
    C005Id INT NOT NULL,
    C010Id INT NOT NULL,
    C030Id INT NULL,                              -- migracion 012
    TipoOperacion VARCHAR(30) NOT NULL,           -- LONG | SHORT
    PrecioEntrada DECIMAL(18,6) NOT NULL,
    Cantidad DECIMAL(18,6) NULL,
    FechaEntrada DATETIME NOT NULL,
    TemporalidadOrigen VARCHAR(30) NULL,
    NombreOperacion VARCHAR(200) NULL,
    Notas VARCHAR(1000) NULL,
    Estado VARCHAR(30) NOT NULL,                  -- ABIERTA | CERRADA
    PrecioSalida DECIMAL(18,6) NULL,
    FechaSalida DATETIME NULL,
    MotivoSalida VARCHAR(500) NULL,
    Color VARCHAR(30) NULL,
    Visible BIT NOT NULL CONSTRAINT DF_C050_Visible DEFAULT 1,
    Activo BIT NOT NULL CONSTRAINT DF_C050_Activo DEFAULT 1,
    MetadataJSON NVARCHAR(MAX) NULL,              -- migracion 012
    AnalisisJSON NVARCHAR(MAX) NULL,              -- migracion 012
    FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C050_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME NOT NULL CONSTRAINT DF_C050_FechaActualizacion DEFAULT GETDATE(),
    CONSTRAINT FK_C050_C005 FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id),
    CONSTRAINT FK_C050_C010 FOREIGN KEY (C010Id) REFERENCES dbo.C010(C010Id),
    CONSTRAINT FK_C050_C030 FOREIGN KEY (C030Id) REFERENCES dbo.C030(C030Id)  -- migracion 012
);
CREATE INDEX IX_C050_C005Id_C010Id ON dbo.C050(C005Id, C010Id);
CREATE INDEX IX_C050_C005Id_C010Id_Estado ON dbo.C050(C005Id, C010Id, Estado);
CREATE INDEX IX_C050_C005Id_C010Id_C030Id ON dbo.C050(C005Id, C010Id, C030Id);
GO

-- C060-Noticias (migracion 006)
CREATE TABLE dbo.C060 (
    C060Id INT IDENTITY(1,1) PRIMARY KEY,
    Proveedor VARCHAR(50) NOT NULL,
    ExternalId VARCHAR(255) NULL,
    Titulo NVARCHAR(500) NOT NULL,
    Resumen NVARCHAR(MAX) NULL,
    URL NVARCHAR(1000) NOT NULL,
    Publisher VARCHAR(250) NULL,
    ImagenURL NVARCHAR(1000) NULL,
    Categoria VARCHAR(100) NULL,
    Idioma VARCHAR(20) NULL,
    Pais VARCHAR(50) NULL,
    FechaPublicacion DATETIME NULL,
    FechaObtencion DATETIME NOT NULL CONSTRAINT DF_C060_FechaObtencion DEFAULT GETDATE(),
    RawJSON NVARCHAR(MAX) NULL,
    Activo BIT NOT NULL CONSTRAINT DF_C060_Activo DEFAULT 1,
    URLHashKey AS CONVERT(VARBINARY(32), HASHBYTES('SHA2_256', URL)) PERSISTED  -- columna calculada
);
CREATE INDEX IX_C060_Proveedor ON dbo.C060(Proveedor);
CREATE INDEX IX_C060_FechaPublicacion ON dbo.C060(FechaPublicacion);
CREATE INDEX IX_C060_Categoria ON dbo.C060(Categoria);
CREATE INDEX IX_C060_URL ON dbo.C060(URLHashKey);
GO

-- C061-NoticiasInstrumentos (migracion 006)
CREATE TABLE dbo.C061 (
    C061Id INT IDENTITY(1,1) PRIMARY KEY,
    C060Id INT NOT NULL,
    C010Id INT NOT NULL,
    Relevancia DECIMAL(10,4) NULL,
    FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C061_FechaCreacion DEFAULT GETDATE(),
    CONSTRAINT FK_C061_C060 FOREIGN KEY (C060Id) REFERENCES dbo.C060(C060Id),
    CONSTRAINT FK_C061_C010 FOREIGN KEY (C010Id) REFERENCES dbo.C010(C010Id)
);
CREATE INDEX IX_C061_C060Id ON dbo.C061(C060Id);
CREATE INDEX IX_C061_C010Id ON dbo.C061(C010Id);
CREATE INDEX IX_C061_C010Id_C060Id ON dbo.C061(C010Id, C060Id);
GO

-- C062-ListasMercado (migracion 006)
CREATE TABLE dbo.C062 (
    C062Id INT IDENTITY(1,1) PRIMARY KEY,
    TipoLista VARCHAR(50) NOT NULL,   -- TRENDING | TOP_GAINERS | TOP_LOSERS | MOST_ACTIVE
    Proveedor VARCHAR(50) NOT NULL,
    FechaObtencion DATETIME NOT NULL CONSTRAINT DF_C062_FechaObtencion DEFAULT GETDATE(),
    RawJSON NVARCHAR(MAX) NULL,
    Activo BIT NOT NULL CONSTRAINT DF_C062_Activo DEFAULT 1
);
CREATE INDEX IX_C062_TipoLista ON dbo.C062(TipoLista);
CREATE INDEX IX_C062_TipoLista_FechaObtencion ON dbo.C062(TipoLista, FechaObtencion);
GO

-- C063-ListasMercadoDetalle (migracion 006)
CREATE TABLE dbo.C063 (
    C063Id INT IDENTITY(1,1) PRIMARY KEY,
    C062Id INT NOT NULL,
    C010Id INT NULL,
    Ticker VARCHAR(30) NOT NULL,
    YahooSymbol VARCHAR(50) NULL,
    NombreInstrumento VARCHAR(250) NULL,
    Precio DECIMAL(18,6) NULL,
    Cambio DECIMAL(18,6) NULL,
    CambioPorcentaje DECIMAL(18,6) NULL,
    Volumen BIGINT NULL,
    MarketCap DECIMAL(28,2) NULL,
    Ranking INT NULL,
    RawJSON NVARCHAR(MAX) NULL,
    FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C063_FechaCreacion DEFAULT GETDATE(),
    CONSTRAINT FK_C063_C062 FOREIGN KEY (C062Id) REFERENCES dbo.C062(C062Id),
    CONSTRAINT FK_C063_C010 FOREIGN KEY (C010Id) REFERENCES dbo.C010(C010Id)
);
CREATE INDEX IX_C063_C062Id ON dbo.C063(C062Id);
CREATE INDEX IX_C063_Ticker ON dbo.C063(Ticker);
CREATE INDEX IX_C063_C010Id ON dbo.C063(C010Id);
GO

-- C080-MacroMarketCache (migracion 013)
CREATE TABLE dbo.C080 (
    C080Id INT IDENTITY(1,1) PRIMARY KEY,
    TipoDato VARCHAR(100) NOT NULL,
    Proveedor VARCHAR(100) NOT NULL,
    Clave VARCHAR(200) NOT NULL,
    DataJSON NVARCHAR(MAX) NOT NULL,
    FechaObtencion DATETIME NOT NULL CONSTRAINT DF_C080_FechaObtencion DEFAULT GETDATE(),
    FechaExpiracion DATETIME NOT NULL,
    Activo BIT NOT NULL CONSTRAINT DF_C080_Activo DEFAULT 1
);
CREATE INDEX IX_C080_TipoDato ON dbo.C080(TipoDato);
CREATE INDEX IX_C080_Clave ON dbo.C080(Clave);
CREATE INDEX IX_C080_FechaExpiracion ON dbo.C080(FechaExpiracion);
GO

-- C081-ConfiguracionScorecard (migracion 011)
CREATE TABLE dbo.C081 (
    C081Id INT IDENTITY(1,1) PRIMARY KEY,
    C005Id INT NOT NULL,
    NombreConfiguracion VARCHAR(200) NOT NULL,
    EsDefault BIT NOT NULL CONSTRAINT DF_C081_EsDefault DEFAULT 0,
    ConfiguracionJSON NVARCHAR(MAX) NOT NULL,
    Activo BIT NOT NULL CONSTRAINT DF_C081_Activo DEFAULT 1,
    FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C081_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME NOT NULL CONSTRAINT DF_C081_FechaActualizacion DEFAULT GETDATE(),
    CONSTRAINT FK_C081_C005 FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id)
);
CREATE INDEX IX_C081_C005Id ON dbo.C081(C005Id);
GO

-- C090-Portafolios (migracion 014)
CREATE TABLE dbo.C090 (
    C090Id INT IDENTITY(1,1) PRIMARY KEY,
    C005Id INT NOT NULL,
    NombrePortafolio VARCHAR(200) NOT NULL,
    Descripcion VARCHAR(1000) NULL,
    MonedaBase VARCHAR(10) NOT NULL CONSTRAINT DF_C090_MonedaBase DEFAULT 'USD',
    EsDefault BIT NOT NULL CONSTRAINT DF_C090_EsDefault DEFAULT 0,
    Activo BIT NOT NULL CONSTRAINT DF_C090_Activo DEFAULT 1,
    FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C090_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME NOT NULL CONSTRAINT DF_C090_FechaActualizacion DEFAULT GETDATE(),
    CONSTRAINT FK_C090_C005 FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id)
);
CREATE INDEX IX_C090_C005Id ON dbo.C090(C005Id);
CREATE INDEX IX_C090_C005Id_Activo ON dbo.C090(C005Id, Activo);
CREATE INDEX IX_C090_C005Id_EsDefault ON dbo.C090(C005Id, EsDefault);
GO

-- C091-PosicionesPortafolio (migracion 014)
CREATE TABLE dbo.C091 (
    C091Id INT IDENTITY(1,1) PRIMARY KEY,
    C090Id INT NOT NULL,
    C005Id INT NOT NULL,
    C010Id INT NULL,
    Ticker VARCHAR(30) NOT NULL,
    YahooSymbol VARCHAR(50) NULL,
    NombreInstrumento VARCHAR(250) NULL,
    TipoInstrumento VARCHAR(50) NOT NULL CONSTRAINT DF_C091_TipoInstrumento DEFAULT 'STOCK',
    Cantidad DECIMAL(18,6) NOT NULL,
    PrecioCompraPromedio DECIMAL(18,6) NOT NULL,
    FechaCompra DATETIME NULL,
    Moneda VARCHAR(10) NULL,
    Sector VARCHAR(150) NULL,
    Industria VARCHAR(150) NULL,
    Notas VARCHAR(1000) NULL,
    Activo BIT NOT NULL CONSTRAINT DF_C091_Activo DEFAULT 1,
    FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C091_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME NOT NULL CONSTRAINT DF_C091_FechaActualizacion DEFAULT GETDATE(),
    CONSTRAINT FK_C091_C090 FOREIGN KEY (C090Id) REFERENCES dbo.C090(C090Id),
    CONSTRAINT FK_C091_C005 FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id),
    CONSTRAINT FK_C091_C010 FOREIGN KEY (C010Id) REFERENCES dbo.C010(C010Id)
);
CREATE INDEX IX_C091_C090Id ON dbo.C091(C090Id);
CREATE INDEX IX_C091_C005Id ON dbo.C091(C005Id);
CREATE INDEX IX_C091_C090Id_Activo ON dbo.C091(C090Id, Activo);
CREATE INDEX IX_C091_C090Id_Ticker ON dbo.C091(C090Id, Ticker);
CREATE INDEX IX_C091_C010Id ON dbo.C091(C010Id);
GO

-- C092-PreferenciasUsuario (migracion 015)
CREATE TABLE dbo.C092 (
    C092Id INT IDENTITY(1,1) PRIMARY KEY,
    C005Id INT NOT NULL,
    ClavePreferencia VARCHAR(100) NOT NULL,
    ValorJSON NVARCHAR(MAX) NOT NULL,
    Activo BIT NOT NULL CONSTRAINT DF_C092_Activo DEFAULT 1,
    FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C092_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME NOT NULL CONSTRAINT DF_C092_FechaActualizacion DEFAULT GETDATE(),
    CONSTRAINT FK_C092_C005 FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id)
);
CREATE INDEX IX_C092_C005Id ON dbo.C092(C005Id);
-- Una sola preferencia ACTIVA por usuario + clave (indice filtrado unico):
CREATE UNIQUE INDEX UX_C092_C005Id_Clave_Activo
    ON dbo.C092(C005Id, ClavePreferencia) WHERE Activo = 1;
GO

-- C110-ChatConversaciones (migracion 004)
CREATE TABLE dbo.C110 (
    C110Id INT IDENTITY(1,1) PRIMARY KEY,
    C005Id INT NOT NULL,
    C010Id INT NULL,
    TituloConversacion VARCHAR(250) NULL,
    ContextoTicker VARCHAR(30) NULL,
    ContextoYahooSymbol VARCHAR(50) NULL,
    Modelo VARCHAR(100) NOT NULL,
    Activo BIT NOT NULL CONSTRAINT DF_C110_Activo DEFAULT 1,
    FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C110_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME NOT NULL CONSTRAINT DF_C110_FechaActualizacion DEFAULT GETDATE(),
    CONSTRAINT FK_C110_C005 FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id),
    CONSTRAINT FK_C110_C010 FOREIGN KEY (C010Id) REFERENCES dbo.C010(C010Id)
);
CREATE INDEX IX_C110_C005Id ON dbo.C110(C005Id);
CREATE INDEX IX_C110_C010Id ON dbo.C110(C010Id);
CREATE INDEX IX_C110_C005Id_C010Id ON dbo.C110(C005Id, C010Id);
GO

-- C111-ChatMensajes (migracion 004)
CREATE TABLE dbo.C111 (
    C111Id INT IDENTITY(1,1) PRIMARY KEY,
    C110Id INT NOT NULL,
    Rol VARCHAR(30) NOT NULL,                 -- system | user | assistant | tool
    Contenido NVARCHAR(MAX) NOT NULL,
    MetadataJSON NVARCHAR(MAX) NULL,
    TokensEntrada INT NULL,
    TokensSalida INT NULL,
    FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C111_FechaCreacion DEFAULT GETDATE(),
    CONSTRAINT FK_C111_C110 FOREIGN KEY (C110Id) REFERENCES dbo.C110(C110Id)
);
CREATE INDEX IX_C111_C110Id ON dbo.C111(C110Id);
CREATE INDEX IX_C111_C110Id_FechaCreacion ON dbo.C111(C110Id, FechaCreacion);
GO


/* ============================================================================
   PARTE B - Tablas PRE-EXISTENTES (referencia; CREATE original NO esta en el repo)
   El repo solo las ALTERA. Tipos segun el mapeo ORM (String -> VARCHAR; puede ser
   NVARCHAR en la base real). Usa la PARTE C para obtener el DDL exacto.
   ============================================================================ */

-- C005-Usuarios: columnas base (modelo) + auth (migracion 001).
--   C005Id INT PK (sin IDENTITY), NombreUsuario VARCHAR(200) NOT NULL,
--   PasswordHash VARCHAR(255) NOT NULL, Email VARCHAR(200) NOT NULL,
--   Activo BIT NOT NULL, FechaCreacion DATETIME NOT NULL,
--   FechaActualizacion DATETIME NOT NULL,
--   NombreNormalizado AS UPPER(TRIM(NombreUsuario)) PERSISTED,
--   EsAdmin BIT NOT NULL DEFAULT 0, DebeCambiarPassword BIT NOT NULL DEFAULT 1,
--   UltimoAcceso DATETIME NULL, FechaDesactivacion DATETIME NULL.
-- Indices: UQ_C005_NombreNormalizado, UQ_C005_Email (WHERE Email IS NOT NULL).

-- C010-Instrumentos: C010Id INT PK (sin IDENTITY), Ticker VARCHAR(50) NOT NULL,
--   NombreInstrumento VARCHAR(250) NULL, TipoInstrumento VARCHAR(50) NOT NULL,
--   Exchange/Moneda VARCHAR(50) NULL, Pais/Sector/Industria VARCHAR(200) NULL,
--   FuenteDatos VARCHAR(200) NOT NULL, TimezoneMercado VARCHAR(200) NULL,
--   Activo BIT NOT NULL, FechaCreacion/FechaActualizacion DATETIME NOT NULL,
--   YahooSymbol VARCHAR(50) NOT NULL,
--   TickerNormalizado AS UPPER(TRIM(Ticker)) PERSISTED.
-- Indices: UQ_C010_TickerFuente (TickerNormalizado, FuenteDatos).

-- C0101-AnalisisDibujos: C0101Id INT PK, C005Id/C010Id INT NOT NULL,
--   C030Id INT NULL (migracion 010), TipoDibujo/TemporalidadOrigen VARCHAR(50),
--   NombreAnalisis VARCHAR(200) NULL, PuntosJSON/EstiloJSON NVARCHAR(MAX) NOT NULL,
--   Visible/Bloqueado/MostrarEnTodasTemporalidades BIT NOT NULL,
--   TemporalidadesVisiblesJSON NVARCHAR(MAX) NULL, Comentario VARCHAR(500) NULL,
--   Version INT NOT NULL, FechaCreacion/FechaActualizacion DATETIME NOT NULL,
--   Eliminado BIT NOT NULL. FK_C0101_C030 -> C030. Indices migracion 010.

-- C020-IndicadoresConfiguracion: C020Id INT PK, C005Id INT NOT NULL,
--   C010Id INT NULL, TipoIndicador VARCHAR(50), NombreIndicador VARCHAR(200),
--   Visible/AplicarTodasTemporalidades BIT NOT NULL,
--   ParametrosJSON NVARCHAR(MAX) NOT NULL, EstiloJSON NVARCHAR(MAX) NULL,
--   FechaCreacion/FechaActualizacion DATETIME NOT NULL.

-- C030-LayoutsGraficas: C030Id INT PK, C005Id INT NOT NULL,
--   C010Id INT NULL (migracion 009), NombreLayout VARCHAR(200) NOT NULL,
--   EsDefault BIT NOT NULL, ConfiguracionJSON NVARCHAR(MAX) NOT NULL,
--   Activo BIT NOT NULL DEFAULT 1 (migracion 009),
--   FechaCreacion/FechaActualizacion DATETIME NOT NULL.
--   FK_C030_C010 -> C010. Indice IX_C030_C005Id_C010Id.

-- C040-CatalogoUsuarioAcciones: C040Id INT PK, C005Id/C010Id INT NOT NULL,
--   Favorito BIT NOT NULL, TagsJSON NVARCHAR(MAX) NULL, UltimaConsulta DATETIME NULL,
--   Notas VARCHAR(500) NULL, Activo BIT NOT NULL,
--   FechaCreacion/FechaActualizacion DATETIME NOT NULL.
--   Indice UNIQUE UQ_C040_UsuarioAccion (C005Id, C010Id) (migracion 001).

-- ALTERs reales aplicados por las migraciones (referencia idempotente):
--   001: ALTER TABLE dbo.C005 ADD EsAdmin/DebeCambiarPassword/UltimoAcceso/FechaDesactivacion
--   009: ALTER TABLE dbo.C030 ADD C010Id INT NULL; ADD Activo BIT NOT NULL DEFAULT 1; FK_C030_C010
--   010: ALTER TABLE dbo.C0101 ADD C030Id INT NULL; FK_C0101_C030
--   012: ALTER TABLE dbo.C050 ADD C030Id INT NULL; MetadataJSON/AnalisisJSON NVARCHAR(MAX); FK_C050_C030


/* ============================================================================
   PARTE C - Script de INTROSPECCION (ejecutar contra AnalisisTecnico)
   Exporta el esquema REAL de todas las tablas dbo.C* (incluye las pre-existentes).
   ============================================================================ */

-- C.1) Columnas, tipos, longitud/precision/escala, nullabilidad y default.
SELECT
    t.name              AS TableName,
    c.column_id         AS ColumnId,
    c.name              AS ColumnName,
    ty.name             AS DataType,
    c.max_length        AS MaxLength,
    c.precision         AS Precision,
    c.scale             AS Scale,
    c.is_nullable       AS IsNullable,
    c.is_identity       AS IsIdentity,
    c.is_computed       AS IsComputed,
    cc.definition       AS ComputedDefinition,
    dc.definition       AS DefaultDefinition
FROM sys.tables t
JOIN sys.columns c            ON t.object_id = c.object_id
JOIN sys.types ty             ON c.user_type_id = ty.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
LEFT JOIN sys.computed_columns cc    ON c.object_id = cc.object_id AND c.column_id = cc.column_id
WHERE t.name LIKE 'C%'
ORDER BY t.name, c.column_id;

-- C.2) Llaves primarias.
SELECT
    t.name      AS TableName,
    kc.name     AS PkName,
    c.name      AS ColumnName,
    ic.key_ordinal AS Ordinal
FROM sys.key_constraints kc
JOIN sys.tables t           ON kc.parent_object_id = t.object_id
JOIN sys.index_columns ic   ON kc.parent_object_id = ic.object_id AND kc.unique_index_id = ic.index_id
JOIN sys.columns c          ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE kc.type = 'PK' AND t.name LIKE 'C%'
ORDER BY t.name, ic.key_ordinal;

-- C.3) Llaves foraneas (columna -> tabla/columna referenciada).
SELECT
    fk.name                 AS FkName,
    tp.name                 AS TableName,
    cp.name                 AS ColumnName,
    tr.name                 AS RefTableName,
    cr.name                 AS RefColumnName
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.tables tp      ON fkc.parent_object_id = tp.object_id
JOIN sys.columns cp     ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
JOIN sys.tables tr      ON fkc.referenced_object_id = tr.object_id
JOIN sys.columns cr     ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
WHERE tp.name LIKE 'C%'
ORDER BY tp.name, fk.name, fkc.constraint_column_id;

-- C.4) Indices y constraints unicos (incluye filtro y columnas en orden).
SELECT
    t.name      AS TableName,
    i.name      AS IndexName,
    i.is_unique AS IsUnique,
    i.is_primary_key AS IsPrimaryKey,
    i.has_filter AS HasFilter,
    i.filter_definition AS FilterDefinition,
    c.name      AS ColumnName,
    ic.key_ordinal AS Ordinal
FROM sys.indexes i
JOIN sys.tables t           ON i.object_id = t.object_id
JOIN sys.index_columns ic   ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c          ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE t.name LIKE 'C%' AND i.type > 0  -- excluye heaps
ORDER BY t.name, i.name, ic.key_ordinal;
