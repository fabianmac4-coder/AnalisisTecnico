-- 012_simulated_entry_snapshot.sql
-- Entradas simuladas (C050) por workspace + snapshot de análisis al crearlas.
-- Agrega C030Id (nullable, workspace activo), MetadataJSON (clic/vela/gráfica)
-- y AnalisisJSON (scorecard/técnico/canal R/R/tesis). Idempotente.

IF COL_LENGTH('dbo.C050', 'C030Id') IS NULL
BEGIN
    ALTER TABLE dbo.C050 ADD C030Id INT NULL;
END;
GO

IF COL_LENGTH('dbo.C050', 'MetadataJSON') IS NULL
BEGIN
    ALTER TABLE dbo.C050 ADD MetadataJSON NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.C050', 'AnalisisJSON') IS NULL
BEGIN
    ALTER TABLE dbo.C050 ADD AnalisisJSON NVARCHAR(MAX) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_C050_C030'
)
BEGIN
    ALTER TABLE dbo.C050
        ADD CONSTRAINT FK_C050_C030
        FOREIGN KEY (C030Id) REFERENCES dbo.C030(C030Id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C050_C005Id_C010Id_C030Id'
      AND object_id = OBJECT_ID('dbo.C050')
)
BEGIN
    CREATE INDEX IX_C050_C005Id_C010Id_C030Id
        ON dbo.C050(C005Id, C010Id, C030Id);
END;
GO
