"""Contexto del ticker para el modo ChatGPT (iframe/helper).

Este endpoint NO llama a OpenAI y NO escribe en C110/C111: solo devuelve el
contexto del usuario autenticado para que el frontend genere un prompt que el
usuario copia en SU sesión de ChatGPT. Misma política de seguridad que el
chat nativo: jamás PasswordHash/tokens/datos de otros usuarios.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.security.dependencies import get_current_active_user
from app.services import ai_context_service

router = APIRouter(prefix="/chatgpt", tags=["ChatGPT Context"])


@router.get("/context")
def get_chatgpt_context(
    symbol: str = Query(..., min_length=1, max_length=30),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    return ai_context_service.build_chatgpt_context(db, user.C005Id, symbol)
