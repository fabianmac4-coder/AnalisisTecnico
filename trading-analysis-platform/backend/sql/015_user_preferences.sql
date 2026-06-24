-- 015_user_preferences.sql
-- C092 (PreferenciasUsuario): preferencias por usuario (clave/valor JSON).
-- Primer uso: DEFAULT_CHART_LAYOUT_TEMPLATE (plantilla de las seis graficas que
-- se aplica a stocks/workspaces nuevos). Nombre fisico solo-codigo (C092).
-- IDENTITY (tabla nueva, como C006/C050/C081). Idempotente.

IF OBJECT_ID('dbo.C092', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.C092 (
        C092Id INT IDENTITY(1,1) PRIMARY KEY,
        C005Id INT NOT NULL,
        ClavePreferencia VARCHAR(100) NOT NULL,
        ValorJSON NVARCHAR(MAX) NOT NULL,
        Activo BIT NOT NULL CONSTRAINT DF_C092_Activo DEFAULT 1,
        FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C092_FechaCreacion DEFAULT GETDATE(),
        FechaActualizacion DATETIME NOT NULL CONSTRAINT DF_C092_FechaActualizacion DEFAULT GETDATE(),

        CONSTRAINT FK_C092_C005
            FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C092_C005Id'
      AND object_id = OBJECT_ID('dbo.C092')
)
BEGIN
    CREATE INDEX IX_C092_C005Id ON dbo.C092(C005Id);
END;
GO

-- Una sola preferencia ACTIVA por usuario + clave (indice filtrado unico).
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_C092_C005Id_Clave_Activo'
      AND object_id = OBJECT_ID('dbo.C092')
)
BEGIN
    CREATE UNIQUE INDEX UX_C092_C005Id_Clave_Activo
        ON dbo.C092(C005Id, ClavePreferencia)
        WHERE Activo = 1;
END;
GO
