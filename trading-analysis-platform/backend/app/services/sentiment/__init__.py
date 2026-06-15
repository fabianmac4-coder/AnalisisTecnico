"""Servicio de sentimiento de mercado (proxy Fear & Greed).

NO es el indice oficial de CNN: es un proxy interno calculado con datos ya
disponibles (VIX, indices, breadth de movers, tono de noticias). Arquitectura de
proveedores para poder enchufar un proveedor externo en el futuro.
"""
from app.services.sentiment.sentiment_service import compute_sentiment

__all__ = ["compute_sentiment"]
