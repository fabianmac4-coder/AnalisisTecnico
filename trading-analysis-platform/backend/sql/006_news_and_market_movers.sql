-- 006_news_and_market_movers.sql
-- Noticias y market movers (cache SQL de proveedores externos).
-- C060 (Noticias), C061 (NoticiasInstrumentos), C062 (ListasMercado),
-- C063 (ListasMercadoDetalle). Nombres fisicos solo-codigo; los descriptivos
-- viven en la documentacion. Idempotente.

-- ===== C060: noticias cacheadas =====
IF OBJECT_ID('dbo.C060', 'U') IS NULL
BEGIN
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
        Activo BIT NOT NULL CONSTRAINT DF_C060_Activo DEFAULT 1
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C060_Proveedor' AND object_id = OBJECT_ID('dbo.C060'))
BEGIN
    CREATE INDEX IX_C060_Proveedor ON dbo.C060(Proveedor);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C060_FechaPublicacion' AND object_id = OBJECT_ID('dbo.C060'))
BEGIN
    CREATE INDEX IX_C060_FechaPublicacion ON dbo.C060(FechaPublicacion);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C060_Categoria' AND object_id = OBJECT_ID('dbo.C060'))
BEGIN
    CREATE INDEX IX_C060_Categoria ON dbo.C060(Categoria);
END;
GO

-- NVARCHAR(1000) excede el limite de clave de indice clasico: se indexan los
-- primeros 450 caracteres de la URL via columna calculada (suficiente para
-- deduplicar en la practica; el repositorio igual compara la URL completa).
IF COL_LENGTH('dbo.C060', 'URLHashKey') IS NULL
BEGIN
    ALTER TABLE dbo.C060 ADD URLHashKey AS CONVERT(VARBINARY(32), HASHBYTES('SHA2_256', URL)) PERSISTED;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C060_URL' AND object_id = OBJECT_ID('dbo.C060'))
BEGIN
    CREATE INDEX IX_C060_URL ON dbo.C060(URLHashKey);
END;
GO

-- ===== C061: relacion noticia <-> instrumento =====
IF OBJECT_ID('dbo.C061', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.C061 (
        C061Id INT IDENTITY(1,1) PRIMARY KEY,
        C060Id INT NOT NULL,
        C010Id INT NOT NULL,
        Relevancia DECIMAL(10,4) NULL,
        FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C061_FechaCreacion DEFAULT GETDATE(),

        CONSTRAINT FK_C061_C060
            FOREIGN KEY (C060Id) REFERENCES dbo.C060(C060Id),

        CONSTRAINT FK_C061_C010
            FOREIGN KEY (C010Id) REFERENCES dbo.C010(C010Id)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C061_C060Id' AND object_id = OBJECT_ID('dbo.C061'))
BEGIN
    CREATE INDEX IX_C061_C060Id ON dbo.C061(C060Id);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C061_C010Id' AND object_id = OBJECT_ID('dbo.C061'))
BEGIN
    CREATE INDEX IX_C061_C010Id ON dbo.C061(C010Id);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C061_C010Id_C060Id' AND object_id = OBJECT_ID('dbo.C061'))
BEGIN
    CREATE INDEX IX_C061_C010Id_C060Id ON dbo.C061(C010Id, C060Id);
END;
GO

-- ===== C062: snapshots de listas de mercado =====
IF OBJECT_ID('dbo.C062', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.C062 (
        C062Id INT IDENTITY(1,1) PRIMARY KEY,
        TipoLista VARCHAR(50) NOT NULL,   -- TRENDING | TOP_GAINERS | TOP_LOSERS | MOST_ACTIVE
        Proveedor VARCHAR(50) NOT NULL,
        FechaObtencion DATETIME NOT NULL CONSTRAINT DF_C062_FechaObtencion DEFAULT GETDATE(),
        RawJSON NVARCHAR(MAX) NULL,
        Activo BIT NOT NULL CONSTRAINT DF_C062_Activo DEFAULT 1
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C062_TipoLista' AND object_id = OBJECT_ID('dbo.C062'))
BEGIN
    CREATE INDEX IX_C062_TipoLista ON dbo.C062(TipoLista);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C062_TipoLista_FechaObtencion' AND object_id = OBJECT_ID('dbo.C062'))
BEGIN
    CREATE INDEX IX_C062_TipoLista_FechaObtencion ON dbo.C062(TipoLista, FechaObtencion);
END;
GO

-- ===== C063: detalle (tickers) de cada snapshot =====
IF OBJECT_ID('dbo.C063', 'U') IS NULL
BEGIN
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

        CONSTRAINT FK_C063_C062
            FOREIGN KEY (C062Id) REFERENCES dbo.C062(C062Id),

        CONSTRAINT FK_C063_C010
            FOREIGN KEY (C010Id) REFERENCES dbo.C010(C010Id)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C063_C062Id' AND object_id = OBJECT_ID('dbo.C063'))
BEGIN
    CREATE INDEX IX_C063_C062Id ON dbo.C063(C062Id);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C063_Ticker' AND object_id = OBJECT_ID('dbo.C063'))
BEGIN
    CREATE INDEX IX_C063_Ticker ON dbo.C063(Ticker);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C063_C010Id' AND object_id = OBJECT_ID('dbo.C063'))
BEGIN
    CREATE INDEX IX_C063_C010Id ON dbo.C063(C010Id);
END;
GO
