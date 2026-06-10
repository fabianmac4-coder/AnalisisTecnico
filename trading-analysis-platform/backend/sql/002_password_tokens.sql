-- 002: Tabla dbo.C006 de tokens de set/reset de password.
-- Solo se guarda el HASH del token (nunca el token crudo).
-- Idempotente: se puede ejecutar varias veces sin error.

IF OBJECT_ID('dbo.C006', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.C006 (
        C006Id INT IDENTITY(1,1) PRIMARY KEY,
        C005Id INT NOT NULL,
        TokenHash VARCHAR(255) NOT NULL,
        TipoToken VARCHAR(50) NOT NULL,
        Usado BIT NOT NULL CONSTRAINT DF_C006_Usado DEFAULT 0,
        FechaExpiracion DATETIME NOT NULL,
        FechaUso DATETIME NULL,
        FechaCreacion DATETIME NOT NULL CONSTRAINT DF_C006_FechaCreacion DEFAULT GETDATE(),

        CONSTRAINT FK_C006_C005
            FOREIGN KEY (C005Id) REFERENCES dbo.C005(C005Id)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C006_C005Id'
      AND object_id = OBJECT_ID('dbo.C006')
)
BEGIN
    CREATE INDEX IX_C006_C005Id
    ON dbo.C006(C005Id);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_C006_TokenHash'
      AND object_id = OBJECT_ID('dbo.C006')
)
BEGIN
    CREATE INDEX IX_C006_TokenHash
    ON dbo.C006(TokenHash);
END;
