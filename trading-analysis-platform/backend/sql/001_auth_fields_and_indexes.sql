-- 001: Campos de autenticacion en dbo.C005 + indices unicos.
-- Idempotente: se puede ejecutar varias veces sin error.

-- ===== Campos de auth en dbo.C005 =====
IF COL_LENGTH('dbo.C005', 'EsAdmin') IS NULL
BEGIN
    ALTER TABLE dbo.C005
    ADD EsAdmin BIT NOT NULL CONSTRAINT DF_C005_EsAdmin DEFAULT 0;
END;

IF COL_LENGTH('dbo.C005', 'DebeCambiarPassword') IS NULL
BEGIN
    ALTER TABLE dbo.C005
    ADD DebeCambiarPassword BIT NOT NULL CONSTRAINT DF_C005_DebeCambiarPassword DEFAULT 1;
END;

IF COL_LENGTH('dbo.C005', 'UltimoAcceso') IS NULL
BEGIN
    ALTER TABLE dbo.C005
    ADD UltimoAcceso DATETIME NULL;
END;

IF COL_LENGTH('dbo.C005', 'FechaDesactivacion') IS NULL
BEGIN
    ALTER TABLE dbo.C005
    ADD FechaDesactivacion DATETIME NULL;
END;

-- NOTA: NombreNormalizado y TickerNormalizado son COLUMNAS CALCULADAS
-- persistidas (UPPER(TRIM(...))) en la base real: no se actualizan a mano y
-- los indices unicos se crean directamente sobre ellas.

-- ===== Indices unicos =====
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_C005_NombreNormalizado'
      AND object_id = OBJECT_ID('dbo.C005')
)
BEGIN
    CREATE UNIQUE INDEX UQ_C005_NombreNormalizado
    ON dbo.C005(NombreNormalizado);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_C005_Email'
      AND object_id = OBJECT_ID('dbo.C005')
)
BEGIN
    CREATE UNIQUE INDEX UQ_C005_Email
    ON dbo.C005(Email)
    WHERE Email IS NOT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_C010_TickerFuente'
      AND object_id = OBJECT_ID('dbo.C010')
)
BEGIN
    CREATE UNIQUE INDEX UQ_C010_TickerFuente
    ON dbo.C010(TickerNormalizado, FuenteDatos);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_C040_UsuarioAccion'
      AND object_id = OBJECT_ID('dbo.C040')
)
BEGIN
    CREATE UNIQUE INDEX UQ_C040_UsuarioAccion
    ON dbo.C040(C005Id, C010Id);
END;
