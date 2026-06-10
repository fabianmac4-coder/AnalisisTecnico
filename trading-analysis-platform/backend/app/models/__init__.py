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

__all__ = [
    "Usuario",
    "Accion",
    "AnalisisDibujo",
    "IndicadorConfiguracion",
    "LayoutGrafica",
    "CatalogoUsuarioAccion",
    "PasswordToken",
]
