-- 004_ai_chat.sql
-- Chat de IA: C110 (ChatConversaciones) y C111 (ChatMensajes).
-- Convencion del proyecto: nombres fisicos SOLO con codigo (C110, C111);
-- los nombres descriptivos (C110-ChatConversaciones, C111-ChatMensajes)
-- viven unicamente en la documentacion/Excel.
-- Idempotente: se puede re-ejecutar sin efectos.

-- ===== C110: conversaciones (una por usuario y, opcionalmente, accion) =====
IF OBJECT_ID('dbo.C110', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.C110 (
        C110Id INT IDENTITY(1,1) PRIMARY KEY,
        C005Id INT NOT NULL,
        C010Id INT NULL,
        TituloConversacion VARCHAR(250) NULL,
        ContextoTicker VARCHAR(30) NULL,
        ContextoYahooSymbol VARCHAR(50) NULL,
        Modelo VARCHAR(100) NOT NULL,
        Activo BIT NOT NULL CONSTRAINT DF_C110_Activo DEFAULT 1,
        FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C110_FechaCreacion DEFAULT GETDATE(),
        FechaActualizacion DATETIME NOT NULL CONSTRAINT DF_C110_FechaActualizacion DEFAULT GETDATE(),

        CONSTRAINT FK_C110_C005
            FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id),

        CONSTRAINT FK_C110_C010
            FOREIGN KEY (C010Id) REFERENCES dbo.C010(C010Id)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C110_C005Id'
      AND object_id = OBJECT_ID('dbo.C110')
)
BEGIN
    CREATE INDEX IX_C110_C005Id ON dbo.C110(C005Id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C110_C010Id'
      AND object_id = OBJECT_ID('dbo.C110')
)
BEGIN
    CREATE INDEX IX_C110_C010Id ON dbo.C110(C010Id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C110_C005Id_C010Id'
      AND object_id = OBJECT_ID('dbo.C110')
)
BEGIN
    CREATE INDEX IX_C110_C005Id_C010Id ON dbo.C110(C005Id, C010Id);
END;
GO

-- ===== C111: mensajes de cada conversacion =====
IF OBJECT_ID('dbo.C111', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.C111 (
        C111Id INT IDENTITY(1,1) PRIMARY KEY,
        C110Id INT NOT NULL,
        Rol VARCHAR(30) NOT NULL,                -- system | user | assistant | tool
        Contenido NVARCHAR(MAX) NOT NULL,
        MetadataJSON NVARCHAR(MAX) NULL,
        TokensEntrada INT NULL,
        TokensSalida INT NULL,
        FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C111_FechaCreacion DEFAULT GETDATE(),

        CONSTRAINT FK_C111_C110
            FOREIGN KEY (C110Id) REFERENCES dbo.C110(C110Id)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C111_C110Id'
      AND object_id = OBJECT_ID('dbo.C111')
)
BEGIN
    CREATE INDEX IX_C111_C110Id ON dbo.C111(C110Id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C111_C110Id_FechaCreacion'
      AND object_id = OBJECT_ID('dbo.C111')
)
BEGIN
    CREATE INDEX IX_C111_C110Id_FechaCreacion ON dbo.C111(C110Id, FechaCreacion);
END;
GO
