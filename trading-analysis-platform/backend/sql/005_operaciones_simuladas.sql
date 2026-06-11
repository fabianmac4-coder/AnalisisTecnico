-- 005_operaciones_simuladas.sql
-- C050 (OperacionesSimuladas): entradas simuladas / paper trading por usuario.
-- Convencion: nombre fisico solo-codigo (C050); el nombre descriptivo
-- (C050-OperacionesSimuladas) vive solo en la documentacion. Idempotente.

IF OBJECT_ID('dbo.C050', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.C050 (
        C050Id INT IDENTITY(1,1) PRIMARY KEY,
        C005Id INT NOT NULL,
        C010Id INT NOT NULL,
        TipoOperacion VARCHAR(30) NOT NULL,          -- LONG | SHORT
        PrecioEntrada DECIMAL(18,6) NOT NULL,
        Cantidad DECIMAL(18,6) NULL,
        FechaEntrada DATETIME NOT NULL,
        TemporalidadOrigen VARCHAR(30) NULL,
        NombreOperacion VARCHAR(200) NULL,
        Notas VARCHAR(1000) NULL,
        Estado VARCHAR(30) NOT NULL,                 -- ABIERTA | CERRADA
        PrecioSalida DECIMAL(18,6) NULL,
        FechaSalida DATETIME NULL,
        MotivoSalida VARCHAR(500) NULL,
        Color VARCHAR(30) NULL,
        Visible BIT NOT NULL CONSTRAINT DF_C050_Visible DEFAULT 1,
        Activo BIT NOT NULL CONSTRAINT DF_C050_Activo DEFAULT 1,
        FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C050_FechaCreacion DEFAULT GETDATE(),
        FechaActualizacion DATETIME NOT NULL CONSTRAINT DF_C050_FechaActualizacion DEFAULT GETDATE(),

        CONSTRAINT FK_C050_C005
            FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id),

        CONSTRAINT FK_C050_C010
            FOREIGN KEY (C010Id) REFERENCES dbo.C010(C010Id)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C050_C005Id_C010Id'
      AND object_id = OBJECT_ID('dbo.C050')
)
BEGIN
    CREATE INDEX IX_C050_C005Id_C010Id ON dbo.C050(C005Id, C010Id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C050_C005Id_C010Id_Estado'
      AND object_id = OBJECT_ID('dbo.C050')
)
BEGIN
    CREATE INDEX IX_C050_C005Id_C010Id_Estado ON dbo.C050(C005Id, C010Id, Estado);
END;
GO
