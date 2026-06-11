"""Modelos SQLAlchemy mapeados a las tablas reales de AnalisisTecnico.

IMPORTANTE (esquema real verificado):
- Ninguna tabla original usa IDENTITY: los IDs se calculan con MAX+1
  (ver repositories/sql_utils.next_id). Solo dbo.C006 (nueva) es IDENTITY.
- NombreNormalizado (C005) y TickerNormalizado (C010) son columnas CALCULADAS
  persistidas UPPER(TRIM(...)): nunca se escriben desde la app.
"""
from app.models.usuario import Usuario
from app.models.accion import Accion
from app.models.analisis_dibujo import AnalisisDibujo
from app.models.indicador_configuracion import IndicadorConfiguracion
from app.models.layout_grafica import LayoutGrafica
from app.models.catalogo_usuario_accion import CatalogoUsuarioAccion
from app.models.password_token import PasswordToken
from app.models.chat_conversacion import ChatConversacion
from app.models.chat_mensaje import ChatMensaje
from app.models.operacion_simulada import OperacionSimulada
from app.models.noticia import Noticia
from app.models.noticia_instrumento import NoticiaInstrumento
from app.models.lista_mercado import ListaMercado
from app.models.lista_mercado_detalle import ListaMercadoDetalle

__all__ = [
    "Usuario",
    "Accion",
    "AnalisisDibujo",
    "IndicadorConfiguracion",
    "LayoutGrafica",
    "CatalogoUsuarioAccion",
    "PasswordToken",
    "ChatConversacion",
    "ChatMensaje",
    "OperacionSimulada",
    "Noticia",
    "NoticiaInstrumento",
    "ListaMercado",
    "ListaMercadoDetalle",
]
