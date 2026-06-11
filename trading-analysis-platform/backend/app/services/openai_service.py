"""Integracion con la API de OpenAI (SOLO backend).

Reglas de seguridad:
- OPENAI_API_KEY vive en variables de entorno; nunca se hardcodea, loguea
  ni viaja al frontend.
- Errores de OpenAI se traducen a excepciones limpias (el router decide el
  codigo HTTP); el chat nunca tira la app.
- Timeout y reintento limitado (1) via el propio SDK.
"""
from __future__ import annotations

import logging

from app.config import env_settings

logger = logging.getLogger("openai_service")

SYSTEM_PROMPT = """You are an AI financial analysis assistant embedded in a personal technical analysis platform.

You help the user analyze stocks, ETFs, indexes, and other market instruments using:
- chart context
- technical indicators
- user drawings
- market data
- watchlist notes
- available news

Guidelines:
- Be clear, practical, and concise.
- Explain reasoning in plain language.
- Distinguish facts from interpretation.
- Do not guarantee returns.
- Do not give personalized financial advice as certainty.
- Do not say "buy" or "sell" as an instruction.
- Use language like "bullish scenario", "bearish scenario", "risk zone", "confirmation", "invalidation".
- When data is missing or stale, say so.
- If news context is unavailable, do not invent news.
- If the user asks for a trade idea, provide scenarios, risk levels, and invalidation points rather than commands.
- Respect the active ticker context.
- When useful, refer to user drawings and indicator levels.

The assistant should respond in the same language as the user."""


class AIServiceError(Exception):
    """Error limpio del servicio de IA (sin filtrar secretos)."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def is_configured() -> bool:
    return bool(env_settings.OPENAI_API_KEY)


def _build_client():
    """Cliente OpenAI perezoso (el import falla limpio si falta la lib)."""
    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover - dependencia instalada
        raise AIServiceError(
            "El servicio de IA no está instalado en el servidor", 503
        ) from exc
    return OpenAI(
        api_key=env_settings.OPENAI_API_KEY,
        timeout=env_settings.OPENAI_TIMEOUT_SECONDS,
        max_retries=1,
    )


def generate_reply(
    context_text: str,
    history: list[dict],
    user_message: str,
) -> tuple[str, int | None, int | None]:
    """Genera la respuesta del asistente.

    history: lista de {"role": "user"|"assistant", "content": str} (ya acotada).
    Devuelve (contenido, tokens_entrada, tokens_salida).
    """
    if not is_configured():
        raise AIServiceError(
            "El servicio de IA no está configurado (falta OPENAI_API_KEY)", 503
        )

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if context_text:
        messages.append(
            {
                "role": "system",
                "content": f"Active instrument context (structured):\n{context_text}",
            }
        )
    for item in history:
        if item.get("role") in ("user", "assistant") and item.get("content"):
            messages.append({"role": item["role"], "content": item["content"]})
    messages.append({"role": "user", "content": user_message})

    client = _build_client()
    try:
        return _call_openai(client, messages)
    except AIServiceError:
        raise
    except Exception as exc:  # noqa: BLE001 - traducir a error limpio
        # Nunca loguear la clave ni el prompt completo: solo el tipo de error.
        logger.error("Fallo en la llamada a OpenAI: %s", type(exc).__name__)
        raise AIServiceError(_map_error(exc)) from exc


def _unsupported_param(exc: Exception) -> str | None:
    """Si el modelo rechazo un parametro (p.ej. temperature/max_tokens en
    modelos nuevos), devuelve su nombre para reintentar sin el."""
    if type(exc).__name__ != "BadRequestError":
        return None
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        err = body.get("error", body)
        if isinstance(err, dict) and err.get("param"):
            return str(err["param"])
    return None


def _create_dropping_unsupported(create_fn, kwargs: dict):
    """Llama a la API; si el modelo rechaza parametros opcionales, los quita
    y reintenta (los modelos gpt-5.x no aceptan temperature/max_tokens)."""
    for _ in range(3):
        try:
            return create_fn(**kwargs)
        except Exception as exc:  # noqa: BLE001 - solo se traga params no soportados
            param = _unsupported_param(exc)
            if param and param in kwargs and param not in ("model",):
                logger.warning("Modelo sin soporte de '%s': reintentando sin el", param)
                kwargs.pop(param)
                continue
            raise
    return create_fn(**kwargs)


def _call_openai(client, messages: list[dict]) -> tuple[str, int | None, int | None]:
    """Prefiere la Responses API; cae a chat.completions si no existe."""
    if hasattr(client, "responses"):
        try:
            response = _create_dropping_unsupported(
                client.responses.create,
                {
                    "model": env_settings.OPENAI_MODEL,
                    "input": messages,
                    "temperature": env_settings.OPENAI_TEMPERATURE,
                    "max_output_tokens": env_settings.OPENAI_MAX_OUTPUT_TOKENS,
                },
            )
            content = getattr(response, "output_text", None)
            if content:
                usage = getattr(response, "usage", None)
                return (
                    content,
                    getattr(usage, "input_tokens", None) if usage else None,
                    getattr(usage, "output_tokens", None) if usage else None,
                )
        except TypeError:
            # SDK sin algun parametro de Responses: usar chat.completions.
            pass

    completion = _create_dropping_unsupported(
        client.chat.completions.create,
        {
            "model": env_settings.OPENAI_MODEL,
            "messages": messages,
            "temperature": env_settings.OPENAI_TEMPERATURE,
            # max_tokens esta deprecado: los modelos nuevos exigen este nombre.
            "max_completion_tokens": env_settings.OPENAI_MAX_OUTPUT_TOKENS,
        },
    )
    content = completion.choices[0].message.content or ""
    usage = getattr(completion, "usage", None)
    return (
        content,
        getattr(usage, "prompt_tokens", None) if usage else None,
        getattr(usage, "completion_tokens", None) if usage else None,
    )


def _map_error(exc: Exception) -> str:
    name = type(exc).__name__
    # El SDK reporta la falta de saldo como RateLimitError code=insufficient_quota.
    body = getattr(exc, "body", None)
    code = ""
    if isinstance(body, dict):
        err = body.get("error", body)
        if isinstance(err, dict):
            code = str(err.get("code") or err.get("type") or "")
    if code == "insufficient_quota":
        return (
            "La cuenta de OpenAI no tiene saldo disponible. Agrega crédito en "
            "platform.openai.com (Billing) y vuelve a intentar"
        )
    if "Timeout" in name or "timeout" in str(exc).lower():
        return "El servicio de IA tardó demasiado en responder; intenta de nuevo"
    if "RateLimit" in name:
        return "El servicio de IA está saturado; espera un momento e intenta de nuevo"
    if "Authentication" in name or "PermissionDenied" in name:
        return "La clave del servicio de IA no es válida; revisa la configuración"
    if "NotFound" in name:
        return "El modelo de IA configurado no está disponible; revisa OPENAI_MODEL"
    return "El servicio de IA no está disponible en este momento"
