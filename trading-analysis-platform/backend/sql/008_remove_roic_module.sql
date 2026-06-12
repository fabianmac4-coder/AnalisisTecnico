-- 008_remove_roic_module.sql
-- Elimina por completo el modulo ROIC.ai (tablas C070-C073 y sus FKs).
-- Las cuatro tablas eran EXCLUSIVAS de ROIC; ningun otro modulo las usa.
-- Idempotente (IF OBJECT_ID / sys.foreign_keys): seguro re-ejecutar y seguro
-- sobre una base que nunca tuvo el modulo (no-op).
-- Orden: hijos antes que padres; FKs antes que DROP TABLE.

-- ===== C073 (log de requests) =====
IF OBJECT_ID('dbo.C073', 'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_C073_C005')
        ALTER TABLE dbo.C073 DROP CONSTRAINT FK_C073_C005;
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_C073_C010')
        ALTER TABLE dbo.C073 DROP CONSTRAINT FK_C073_C010;
    DROP TABLE dbo.C073;
END;
GO

-- ===== C071 (historial de analisis; FK a C005/C010/C110) =====
IF OBJECT_ID('dbo.C071', 'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_C071_C005')
        ALTER TABLE dbo.C071 DROP CONSTRAINT FK_C071_C005;
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_C071_C010')
        ALTER TABLE dbo.C071 DROP CONSTRAINT FK_C071_C010;
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_C071_C110')
        ALTER TABLE dbo.C071 DROP CONSTRAINT FK_C071_C110;
    DROP TABLE dbo.C071;
END;
GO

-- ===== C072 (templates de prompts; sin FKs) =====
IF OBJECT_ID('dbo.C072', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.C072;
END;
GO

-- ===== C070 (cache de fundamentales; FK a C010) =====
IF OBJECT_ID('dbo.C070', 'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_C070_C010')
        ALTER TABLE dbo.C070 DROP CONSTRAINT FK_C070_C010;
    DROP TABLE dbo.C070;
END;
GO
