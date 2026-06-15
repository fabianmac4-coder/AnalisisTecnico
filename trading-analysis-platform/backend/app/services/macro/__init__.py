"""Macro Dashboard (Fase 3).

Entorno macroeconómico (tasas, inflación, empleo, curva, mercados globales,
calendario) con arquitectura de proveedores OPCIONALES (FRED + calendario) y
proxies de Yahoo. Sin claves configuradas la página muestra datos PARCIALES,
nunca falla. NO es señal de compra/venta.
"""
from app.services.macro.macro_service import get_macro_context, get_overview

__all__ = ["get_overview", "get_macro_context"]
