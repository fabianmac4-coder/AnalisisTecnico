"""Soporte para redes corporativas con proxy TLS (MITM).

En esas redes, curl_cffi (usado por yfinance) falla con
"unable to get local issuer certificate" porque no confia en el root CA del
proxy, aunque Windows si lo tenga instalado.

Este modulo genera, en Windows, un CA bundle combinando certifi + el almacen de
certificados del sistema, y exporta las variables de entorno que curl/requests
leen (CURL_CA_BUNDLE, SSL_CERT_FILE, REQUESTS_CA_BUNDLE). En otros sistemas no
hace nada (certifi por defecto suele bastar).

Se invoca una vez al arrancar la app, antes de cualquier consulta a yfinance.
"""
from __future__ import annotations

import os
import ssl
import sys
from pathlib import Path

_BUNDLE = Path(__file__).resolve().parent.parent / ".certs" / "win-ca-bundle.pem"


def _generate_windows_bundle() -> Path | None:
    try:
        _BUNDLE.parent.mkdir(parents=True, exist_ok=True)
        blocks: list[str] = []
        try:
            import certifi

            blocks.append(Path(certifi.where()).read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass

        seen: set[bytes] = set()
        for store in ("ROOT", "CA"):
            try:
                for der, _enc, _trust in ssl.enum_certificates(store):  # type: ignore[attr-defined]
                    if der in seen:
                        continue
                    seen.add(der)
                    blocks.append(ssl.DER_cert_to_PEM_cert(der))
            except Exception:  # noqa: BLE001
                continue

        if not blocks:
            return None
        _BUNDLE.write_text("\n".join(blocks), encoding="utf-8")
        return _BUNDLE
    except Exception:  # noqa: BLE001
        return None


def ensure_ca_bundle() -> None:
    """Configura el CA bundle del sistema en Windows si aun no esta seteado."""
    if sys.platform != "win32":
        return
    # Respeta una configuracion explicita del usuario.
    if os.environ.get("CURL_CA_BUNDLE"):
        return

    bundle = _BUNDLE if _BUNDLE.exists() else _generate_windows_bundle()
    if bundle is None:
        return

    path = str(bundle)
    os.environ.setdefault("CURL_CA_BUNDLE", path)
    os.environ.setdefault("SSL_CERT_FILE", path)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", path)
