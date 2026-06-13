"""Chat de IA por instrumento (dbo.C110/C111 + OpenAI, SOLO backend).

- Todos los endpoints exigen usuario autenticado y activo.
- Cada consulta se acota por C005Id: un usuario jamas ve chats de otro.
- La clave de OpenAI nunca sale del servidor.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import env_settings
from app.database import get_db
from app.models import ChatConversacion, ChatMensaje, Usuario
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.chat_repository import ChatRepository
from app.security.dependencies import get_current_active_user
from app.services import ai_context_service, openai_service
from app.services.openai_service import AIServiceError

router = APIRouter(prefix="/ai", tags=["AI Chat"])

MAX_MESSAGE_LENGTH = 4000


# ===== Rate limit simple en memoria (por usuario) =====

_recent_messages: dict[int, deque[float]] = defaultdict(deque)


def _check_rate_limit(user_id: int) -> None:
    limit = env_settings.AI_CHAT_MAX_MESSAGES_PER_MINUTE
    now = time.monotonic()
    window = _recent_messages[user_id]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Demasiados mensajes por minuto; espera un momento",
        )
    window.append(now)


def _reset_rate_limit() -> None:
    """Solo para tests."""
    _recent_messages.clear()


# ===== Schemas =====


class ConversationOut(BaseModel):
    id: int
    title: str | None = None
    symbol: str | None = None
    yahooSymbol: str | None = None
    model: str
    active: bool
    createdAt: str
    updatedAt: str


class ConversationCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=30)
    title: str | None = Field(default=None, max_length=250)


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=250)


class MessageOut(BaseModel):
    id: int
    conversationId: int
    role: str
    content: str
    createdAt: str


class SendMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)
    includeChartContext: bool = True
    includeDrawings: bool = True
    includeIndicators: bool = True
    includeNews: bool = True
    # R/R de canal calculado en el frontend con los dibujos seleccionados
    # (hipotetico; se inyecta tal cual al contexto del modelo).
    channelRiskReward: dict | None = None
    # Workspace de analisis activo (nombre + configuracion de los seis slots).
    workspace: dict | None = None


class SendMessageResponse(BaseModel):
    userMessage: MessageOut
    assistantMessage: MessageOut


def _conv_out(conv: ChatConversacion) -> ConversationOut:
    return ConversationOut(
        id=conv.C110Id,
        title=conv.TituloConversacion,
        symbol=conv.ContextoTicker,
        yahooSymbol=conv.ContextoYahooSymbol,
        model=conv.Modelo,
        active=bool(conv.Activo),
        createdAt=conv.FechaCreacion.isoformat(),
        updatedAt=conv.FechaActualizacion.isoformat(),
    )


def _msg_out(msg: ChatMensaje) -> MessageOut:
    return MessageOut(
        id=msg.C111Id,
        conversationId=msg.C110Id,
        role=msg.Rol,
        content=msg.Contenido,
        createdAt=msg.FechaCreacion.isoformat(),
    )


def _get_owned_conversation(
    db: Session, user: Usuario, conversation_id: int
) -> ChatConversacion:
    conv = ChatRepository(db).get_conversation_for_user(user.C005Id, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return conv


# ===== Endpoints =====


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    symbol: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[ConversationOut]:
    repo = ChatRepository(db)
    c010_id: int | None = None
    if symbol:
        accion = AccionesRepository(db).get_by_yahoo_symbol(symbol)
        if accion is not None:
            c010_id = accion.C010Id
    convs = repo.list_conversations_for_user(
        user.C005Id, c010_id=c010_id, ticker=symbol if c010_id is None else None
    )
    return [_conv_out(c) for c in convs]


@router.post("/conversations", response_model=ConversationOut, status_code=201)
def create_conversation(
    payload: ConversationCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> ConversationOut:
    symbol = payload.symbol.strip().upper()
    accion = AccionesRepository(db).get_or_create_from_yahoo_symbol(symbol)
    conv = ChatRepository(db).create_conversation(
        user_id=user.C005Id,
        c010_id=accion.C010Id,
        ticker=accion.Ticker,
        yahoo_symbol=accion.YahooSymbol,
        title=payload.title or f"Análisis de {symbol}",
        model=env_settings.OPENAI_MODEL,
    )
    db.commit()
    return _conv_out(conv)


@router.get(
    "/conversations/{conversation_id}/messages", response_model=list[MessageOut]
)
def list_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[MessageOut]:
    _get_owned_conversation(db, user, conversation_id)
    rows = ChatRepository(db).list_messages(user.C005Id, conversation_id)
    # Solo user/assistant son visibles en la UI (system/tool son internos).
    return [_msg_out(m) for m in rows if m.Rol in ("user", "assistant")]


@router.post(
    "/conversations/{conversation_id}/messages", response_model=SendMessageResponse
)
def send_message(
    conversation_id: int,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> SendMessageResponse:
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="El mensaje está vacío")

    conv = _get_owned_conversation(db, user, conversation_id)
    _check_rate_limit(user.C005Id)
    repo = ChatRepository(db)

    # Historial previo acotado (antes de guardar el mensaje nuevo).
    prior = repo.list_messages(
        user.C005Id, conversation_id, limit=env_settings.AI_CHAT_MAX_CONTEXT_MESSAGES
    )
    history = [
        {"role": m.Rol, "content": m.Contenido}
        for m in prior
        if m.Rol in ("user", "assistant")
    ]

    # 1) Guardar el mensaje del usuario (queda aunque la IA falle).
    user_msg = repo.add_message(conversation_id, "user", payload.message.strip())
    repo.touch(conv)
    db.commit()

    # 2) Construir contexto del instrumento.
    symbol = conv.ContextoYahooSymbol or conv.ContextoTicker or ""
    try:
        context = ai_context_service.build_stock_context(
            db,
            user_id=user.C005Id,
            c010_id=conv.C010Id,
            symbol=symbol,
            include_chart_context=payload.includeChartContext,
            include_drawings=payload.includeDrawings,
            include_indicators=payload.includeIndicators,
            include_news=payload.includeNews,
        )
        if payload.channelRiskReward:
            context["channelRiskReward"] = payload.channelRiskReward
        if payload.workspace:
            context["activeWorkspace"] = payload.workspace
        context_text = ai_context_service.context_to_text(context)
    except Exception:  # noqa: BLE001 - el contexto nunca debe romper el chat
        context_text = f'{{"symbol": "{symbol}", "context_available": false}}'

    # 3) Llamar a OpenAI.
    try:
        content, tokens_in, tokens_out = openai_service.generate_reply(
            context_text=context_text,
            history=history,
            user_message=payload.message.strip(),
        )
    except AIServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc))

    # 4) Guardar la respuesta del asistente.
    assistant_msg = repo.add_message(
        conversation_id,
        "assistant",
        content,
        metadata={"model": conv.Modelo},
        tokens_input=tokens_in,
        tokens_output=tokens_out,
    )
    repo.touch(conv)
    db.commit()

    return SendMessageResponse(
        userMessage=_msg_out(user_msg), assistantMessage=_msg_out(assistant_msg)
    )


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
def rename_conversation(
    conversation_id: int,
    payload: ConversationRename,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> ConversationOut:
    conv = ChatRepository(db).update_conversation_title(
        user.C005Id, conversation_id, payload.title
    )
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    db.commit()
    return _conv_out(conv)


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    deleted = ChatRepository(db).soft_delete_conversation(user.C005Id, conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    db.commit()
