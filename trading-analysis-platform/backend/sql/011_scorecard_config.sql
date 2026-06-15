-- 011_scorecard_config.sql
-- C081 (ConfiguracionScorecard): preferencias de puntuacion del Stock Scorecard
-- por usuario (pesos + umbrales). Nombre fisico solo-codigo (C081). IDENTITY
-- (tabla nueva, como C006/C050). Idempotente.

IF OBJECT_ID('dbo.C081', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.C081 (
        C081Id INT IDENTITY(1,1) PRIMARY KEY,
        C005Id INT NOT NULL,
        NombreConfiguracion VARCHAR(200) NOT NULL,
        EsDefault BIT NOT NULL CONSTRAINT DF_C081_EsDefault DEFAULT 0,
        ConfiguracionJSON NVARCHAR(MAX) NOT NULL,
        Activo BIT NOT NULL CONSTRAINT DF_C081_Activo DEFAULT 1,
        FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C081_FechaCreacion DEFAULT GETDATE(),
        FechaActualizacion DATETIME NOT NULL CONSTRAINT DF_C081_FechaActualizacion DEFAULT GETDATE(),

        CONSTRAINT FK_C081_C005
            FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C081_C005Id'
      AND object_id = OBJECT_ID('dbo.C081')
)
BEGIN
    CREATE INDEX IX_C081_C005Id ON dbo.C081(C005Id);
END;
GO
