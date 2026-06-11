"""Noticia -> dbo.C060 (cache de noticias de proveedores externos).

Nombre documental: C060-Noticias. Nombre fisico SQL: C060.
La columna calculada URLHashKey (solo SQL Server, para indexar URLs largas)
NO se mapea: la deduplicacion del repositorio compara la URL completa.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Integer, String, UnicodeText

from app.database import Base


class Noticia(Base):
    __tablename__ = "C060"
    __table_args__ = {"schema": "dbo"}

    C060Id = Column(Integer, primary_key=True, index=True)  # IDENTITY(1,1)
    Proveedor = Column(String(50), nullable=False)
    ExternalId = Column(String(255), nullable=True)
    Titulo = Column(String(500), nullable=False)
    Resumen = Column(UnicodeText, nullable=True)
    URL = Column(String(1000), nullable=False)
    Publisher = Column(String(250), nullable=True)
    ImagenURL = Column(String(1000), nullable=True)
    Categoria = Column(String(100), nullable=True)
    Idioma = Column(String(20), nullable=True)
    Pais = Column(String(50), nullable=True)
    FechaPublicacion = Column(DateTime, nullable=True)
    FechaObtencion = Column(DateTime, nullable=False)
    RawJSON = Column(UnicodeText, nullable=True)
    Activo = Column(Boolean, nullable=False, default=True)
