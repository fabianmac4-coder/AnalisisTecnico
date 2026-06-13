-- 009_chart_workspaces.sql
-- Workspaces de analisis por usuario + accion sobre dbo.C030 (LayoutsGraficas).
-- Cada fila C030 pasa a representar UN workspace (seis slots de grafica en
-- ConfiguracionJSON). Se agrega C010Id (nullable, retrocompatible con layouts
-- globales antiguos) y Activo (borrado suave). Idempotente.

-- 1) C010Id: vincula el workspace a una accion (NULL = layout global heredado).
IF COL_LENGTH('dbo.C030', 'C010Id') IS NULL
BEGIN
    ALTER TABLE dbo.C030 ADD C010Id INT NULL;
END;
GO

-- 2) Activo: borrado suave de workspaces (default 1 para filas existentes).
IF COL_LENGTH('dbo.C030', 'Activo') IS NULL
BEGIN
    ALTER TABLE dbo.C030 ADD Activo BIT NOT NULL CONSTRAINT DF_C030_Activo DEFAULT 1;
END;
GO

-- 3) FK a C010 (solo cuando C010Id no es NULL).
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_C030_C010'
)
BEGIN
    ALTER TABLE dbo.C030
        ADD CONSTRAINT FK_C030_C010
        FOREIGN KEY (C010Id) REFERENCES dbo.C010(C010Id);
END;
GO

-- 4) Indice de busqueda por usuario + accion.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C030_C005Id_C010Id'
      AND object_id = OBJECT_ID('dbo.C030')
)
BEGIN
    CREATE INDEX IX_C030_C005Id_C010Id ON dbo.C030(C005Id, C010Id);
END;
GO
