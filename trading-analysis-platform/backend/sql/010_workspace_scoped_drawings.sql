-- 010_workspace_scoped_drawings.sql
-- Aisla los dibujos por workspace de analisis: agrega C030Id (nullable) a
-- dbo.C0101 con FK a C030 e indices. Idempotente.
-- C030Id NULL = dibujo heredado (pre-workspaces); se muestra solo en el
-- workspace por defecto de la accion. Los dibujos nuevos siempre fijan C030Id.

IF COL_LENGTH('dbo.C0101', 'C030Id') IS NULL
BEGIN
    ALTER TABLE dbo.C0101 ADD C030Id INT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_C0101_C030'
)
BEGIN
    ALTER TABLE dbo.C0101
        ADD CONSTRAINT FK_C0101_C030
        FOREIGN KEY (C030Id) REFERENCES dbo.C030(C030Id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C0101_C005Id_C010Id_C030Id'
      AND object_id = OBJECT_ID('dbo.C0101')
)
BEGIN
    CREATE INDEX IX_C0101_C005Id_C010Id_C030Id
        ON dbo.C0101(C005Id, C010Id, C030Id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C0101_C005Id_C010Id_C030Id_TemporalidadOrigen'
      AND object_id = OBJECT_ID('dbo.C0101')
)
BEGIN
    CREATE INDEX IX_C0101_C005Id_C010Id_C030Id_TemporalidadOrigen
        ON dbo.C0101(C005Id, C010Id, C030Id, TemporalidadOrigen);
END;
GO
