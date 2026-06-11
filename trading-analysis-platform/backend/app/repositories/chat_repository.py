"""Repositorio SQL del chat de IA (dbo.C110 / dbo.C111).

SIEMPRE acotado por C005Id: un usuario jamas ve conversaciones de otro.
C110/C111 son tablas nuevas CON IDENTITY (no usan next_id).
"""
from __future__ import annotations

import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ChatConversacion, ChatMensaje
from app.repositories.sql_utils import utcnow


class ChatRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ===== Conversaciones (C110) =====

    def create_conversation(
        self,
        user_id: int,
        c010_id: int | None,
        ticker: str | None,
        yahoo_symbol: str | None,
        title: str | None,
        model: str,
    ) -> ChatConversacion:
        now = utcnow()
        conv = ChatConversacion(
            C005Id=user_id,
            C010Id=c010_id,
            TituloConversacion=title,
            ContextoTicker=ticker,
            ContextoYahooSymbol=yahoo_symbol,
            Modelo=model,
            Activo=True,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(conv)
        self.db.flush()
        return conv

    def list_conversations_for_user(
        self,
        user_id: int,
        c010_id: int | None = None,
        ticker: str | None = None,
    ) -> list[ChatConversacion]:
        query = select(ChatConversacion).where(
            ChatConversacion.C005Id == user_id,
            ChatConversacion.Activo == True,  # noqa: E712
        )
        if c010_id is not None:
            query = query.where(ChatConversacion.C010Id == c010_id)
        elif ticker:
            query = query.where(
                func.upper(ChatConversacion.ContextoTicker) == ticker.strip().upper()
            )
        return list(
            self.db.execute(
                query.order_by(ChatConversacion.FechaActualizacion.desc())
            ).scalars()
        )

    def get_conversation_for_user(
        self, user_id: int, conversation_id: int
    ) -> ChatConversacion | None:
        """Solo devuelve la conversacion si pertenece al usuario (aislamiento)."""
        conv = self.db.get(ChatConversacion, conversation_id)
        if conv is None or conv.C005Id != user_id or not conv.Activo:
            return None
        return conv

    def update_conversation_title(
        self, user_id: int, conversation_id: int, title: str
    ) -> ChatConversacion | None:
        conv = self.get_conversation_for_user(user_id, conversation_id)
        if conv is None:
            return None
        conv.TituloConversacion = title.strip()[:250]
        conv.FechaActualizacion = utcnow()
        self.db.flush()
        return conv

    def soft_delete_conversation(self, user_id: int, conversation_id: int) -> bool:
        """Borrado suave: Activo=0 (los mensajes C111 se conservan)."""
        conv = self.get_conversation_for_user(user_id, conversation_id)
        if conv is None:
            return False
        conv.Activo = False
        conv.FechaActualizacion = utcnow()
        self.db.flush()
        return True

    def touch(self, conv: ChatConversacion) -> None:
        conv.FechaActualizacion = utcnow()
        self.db.flush()

    # ===== Mensajes (C111) =====

    def add_message(
        self,
        conversation_id: int,
        role: str,
        content: str,
        metadata: dict | None = None,
        tokens_input: int | None = None,
        tokens_output: int | None = None,
    ) -> ChatMensaje:
        msg = ChatMensaje(
            C110Id=conversation_id,
            Rol=role,
            Contenido=content,
            MetadataJSON=json.dumps(metadata) if metadata else None,
            TokensEntrada=tokens_input,
            TokensSalida=tokens_output,
            FechaCreacion=utcnow(),
        )
        self.db.add(msg)
        self.db.flush()
        return msg

    def list_messages(
        self, user_id: int, conversation_id: int, limit: int = 100
    ) -> list[ChatMensaje]:
        """Mensajes de una conversacion del usuario (los mas recientes)."""
        conv = self.get_conversation_for_user(user_id, conversation_id)
        if conv is None:
            return []
        rows = list(
            self.db.execute(
                select(ChatMensaje)
                .where(ChatMensaje.C110Id == conversation_id)
                .order_by(ChatMensaje.C111Id.desc())
                .limit(limit)
            ).scalars()
        )
        rows.reverse()  # orden cronologico
        return rows
