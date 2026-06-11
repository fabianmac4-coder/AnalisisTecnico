// Tipos del modulo de market movers (forma de la API /api/market-movers).

export interface MarketMoverDto {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  ranking: number | null;
  source: string;
}

export interface MoversListDto {
  lastUpdated: string | null;
  items: MarketMoverDto[];
}

export interface AllMoversResponse {
  trending: MoversListDto;
  topGainers: MoversListDto;
  topLosers: MoversListDto;
  mostActive: MoversListDto;
  warnings: string[];
}

export const MOVERS_TABS = [
  { key: "trending", label: "Tendencia" },
  { key: "topGainers", label: "Mayores subidas" },
  { key: "topLosers", label: "Mayores caídas" },
  { key: "mostActive", label: "Más activas" },
] as const;

export type MoversTabKey = (typeof MOVERS_TABS)[number]["key"];
