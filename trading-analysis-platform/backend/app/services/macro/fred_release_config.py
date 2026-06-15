"""Config de releases económicos importantes de FRED para el calendario.

Cada entrada tiene un `fred_release_id` ESTABLE (verificado contra el API) y
`keywords` de respaldo para re-resolver el id desde `fred/releases` si el id fijo
fallara. El `impact` es una clasificación propia para la UI.
"""
from __future__ import annotations

IMPORTANT_FRED_RELEASES: list[dict] = [
    {
        "key": "cpi", "displayName": "CPI Inflation", "impact": "HIGH",
        "fred_release_id": 10, "keywords": ["consumer price index"],
    },
    {
        "key": "pce", "displayName": "Personal Income & Outlays (PCE)",
        "impact": "HIGH", "fred_release_id": 54,
        "keywords": ["personal income and outlays"],
    },
    {
        "key": "employment", "displayName": "Employment Situation / NFP",
        "impact": "HIGH", "fred_release_id": 50,
        "keywords": ["employment situation"],
    },
    {
        "key": "gdp", "displayName": "GDP", "impact": "HIGH",
        "fred_release_id": 53, "keywords": ["gross domestic product"],
    },
    {
        "key": "fomc", "displayName": "FOMC / Federal Reserve", "impact": "HIGH",
        "fred_release_id": 101, "keywords": ["fomc press release"],
    },
    {
        "key": "retailSales", "displayName": "Retail Sales", "impact": "MEDIUM",
        "fred_release_id": 9,
        "keywords": ["advance monthly sales for retail"],
    },
    {
        "key": "consumerSentiment", "displayName": "Consumer Sentiment (UMich)",
        "impact": "MEDIUM", "fred_release_id": 91,
        "keywords": ["surveys of consumers"],
    },
]
