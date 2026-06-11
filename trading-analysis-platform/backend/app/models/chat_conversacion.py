"""ChatConversacion -> dbo.C110 (conversaciones de IA; nueva, CON IDENTITY).

Nombre documental: C110-ChatConversaciones. Nombre fisico SQL: C110.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class ChatConversacion(Base):
    __tablename__ = "C110"
    __table_args__ = {"schema": "dbo"}

    C110Id = Column(Integer, primary_key=True, index=True)  # IDENTITY(1,1)
    C005Id = Column(Integer, ForeignKey("dbo.C005.C005Id"), nullable=False)
    C010Id = Column(Integer, ForeignKey("dbo.C010.C010Id"), nullable=True)
    TituloConversacion = Column(String(250), nullable=True)
    ContextoTicker = Column(String(30), nullable=True)
    ContextoYahooSymbol = Column(String(50), nullable=True)
    Modelo = Column(String(100), nullable=False)
    Activo = Column(Boolean, nullable=False, default=True)
    FechaCreacion = Column(DateTime, nullable=False)
    FechaActualizacion = Column(DateTime, nullable=False)

    Mensajes = relationship(
        "ChatMensaje", back_populates="Conversacion", order_by="ChatMensaje.C111Id"
    )
