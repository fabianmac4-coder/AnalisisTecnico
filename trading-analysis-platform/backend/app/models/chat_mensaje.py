"""ChatMensaje -> dbo.C111 (mensajes del chat de IA; nueva, CON IDENTITY).

Nombre documental: C111-ChatMensajes. Nombre fisico SQL: C111.
"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UnicodeText
from sqlalchemy.orm import relationship

from app.database import Base


class ChatMensaje(Base):
    __tablename__ = "C111"
    __table_args__ = {"schema": "dbo"}

    C111Id = Column(Integer, primary_key=True, index=True)  # IDENTITY(1,1)
    C110Id = Column(Integer, ForeignKey("dbo.C110.C110Id"), nullable=False)
    Rol = Column(String(30), nullable=False)  # system | user | assistant | tool
    Contenido = Column(UnicodeText, nullable=False)
    MetadataJSON = Column(UnicodeText, nullable=True)
    TokensEntrada = Column(Integer, nullable=True)
    TokensSalida = Column(Integer, nullable=True)
    FechaCreacion = Column(DateTime, nullable=False)

    Conversacion = relationship("ChatConversacion", back_populates="Mensajes")
