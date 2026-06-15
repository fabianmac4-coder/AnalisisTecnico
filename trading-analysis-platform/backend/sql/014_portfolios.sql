-- 014_portfolios.sql
-- Portfolio Analysis (Fase 4): C090 portafolios + C091 posiciones. Tablas NUEVAS
-- con IDENTITY. C005Id se guarda también en C091 para acotar por usuario sin join.
-- Idempotente.

IF OBJECT_ID('dbo.C090', 'U') IS NULL
BEGIN
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
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C090_C005Id' AND object_id = OBJECT_ID('dbo.C090'))
    CREATE INDEX IX_C090_C005Id ON dbo.C090(C005Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C090_C005Id_Activo' AND object_id = OBJECT_ID('dbo.C090'))
    CREATE INDEX IX_C090_C005Id_Activo ON dbo.C090(C005Id, Activo);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C090_C005Id_EsDefault' AND object_id = OBJECT_ID('dbo.C090'))
    CREATE INDEX IX_C090_C005Id_EsDefault ON dbo.C090(C005Id, EsDefault);
GO

IF OBJECT_ID('dbo.C091', 'U') IS NULL
BEGIN
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
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C091_C090Id' AND object_id = OBJECT_ID('dbo.C091'))
    CREATE INDEX IX_C091_C090Id ON dbo.C091(C090Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C091_C005Id' AND object_id = OBJECT_ID('dbo.C091'))
    CREATE INDEX IX_C091_C005Id ON dbo.C091(C005Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C091_C090Id_Activo' AND object_id = OBJECT_ID('dbo.C091'))
    CREATE INDEX IX_C091_C090Id_Activo ON dbo.C091(C090Id, Activo);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C091_C090Id_Ticker' AND object_id = OBJECT_ID('dbo.C091'))
    CREATE INDEX IX_C091_C090Id_Ticker ON dbo.C091(C090Id, Ticker);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_C091_C010Id' AND object_id = OBJECT_ID('dbo.C091'))
    CREATE INDEX IX_C091_C010Id ON dbo.C091(C010Id);
GO
