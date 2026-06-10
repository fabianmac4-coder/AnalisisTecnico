"""Genera un CA bundle (PEM) combinando certifi + el almacen de certificados de
Windows. Util en redes corporativas con proxy TLS (MITM) donde curl/yfinance
fallan con "unable to get local issuer certificate".

Uso:
    python scripts/export_win_ca.py
    # luego exporta las variables que imprime, o usa run_dev.ps1

El archivo se escribe en backend/.certs/win-ca-bundle.pem.
"""
from __future__ import annotations

import os
import ssl
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / ".certs" / "win-ca-bundle.pem"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pem_blocks: list[str] = []

    # 1) Base publica de certifi (CAs publicas conocidas).
    try:
        import certifi

        pem_blocks.append(Path(certifi.where()).read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        pass

    # 2) Certificados de los almacenes de Windows (incluye el root del proxy).
    seen: set[bytes] = set()
    for store in ("ROOT", "CA"):
        try:
            for der, _enc, _trust in ssl.enum_certificates(store):
                if der in seen:
                    continue
                seen.add(der)
                pem_blocks.append(ssl.DER_cert_to_PEM_cert(der))
        except Exception:  # noqa: BLE001
            continue

    OUT.write_text("\n".join(pem_blocks), encoding="utf-8")
    print(str(OUT))
    print(f"Certificados escritos: {len(seen)} del store de Windows")
    # Sugerencia de variables de entorno.
    print("\nVariables de entorno a usar:")
    for var in ("CURL_CA_BUNDLE", "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE"):
        print(f"  {var}={OUT}")
    os.environ.setdefault("CURL_CA_BUNDLE", str(OUT))


if __name__ == "__main__":
    main()
