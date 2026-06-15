-- 013_market_intelligence_cache.sql
-- C080-MacroMarketCache: cache de inteligencia de mercado, sentimiento y (futuro)
-- datos macro. NO almacena datos de usuario ni secretos. Idempotente.

IF OBJECT_ID('dbo.C080', 'U') IS NULL
BEGIN
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
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C080_TipoDato' AND object_id = OBJECT_ID('dbo.C080')
)
BEGIN
    CREATE INDEX IX_C080_TipoDato ON dbo.C080(TipoDato);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C080_Clave' AND object_id = OBJECT_ID('dbo.C080')
)
BEGIN
    CREATE INDEX IX_C080_Clave ON dbo.C080(Clave);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C080_FechaExpiracion' AND object_id = OBJECT_ID('dbo.C080')
)
BEGIN
    CREATE INDEX IX_C080_FechaExpiracion ON dbo.C080(FechaExpiracion);
END;
GO
