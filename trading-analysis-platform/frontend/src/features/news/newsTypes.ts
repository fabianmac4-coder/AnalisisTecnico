// Tipos del modulo de noticias (forma de la API /api/news/*).

export interface NewsItemDto {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  publisher: string | null;
  provider: string;
  category: string | null;
  publishedAt: string | null;
  fetchedAt: string | null;
  imageUrl: string | null;
  relatedTickers: string[];
  /** Solo en noticias POR SIMBOLO: score/razon del filtro estricto de
   * relevancia del backend (diagnostico; la UI no lo muestra por defecto). */
  relevanceScore?: number;
  relevanceReason?: string;
}

export interface GlobalNewsResponse {
  items: NewsItemDto[];
  lastUpdated: string | null;
  fromCache: boolean;
  warnings: string[];
}

export interface SymbolNewsResponse extends GlobalNewsResponse {
  symbol: string;
  /** Presente cuando ningun item paso el umbral de relevancia. */
  message?: string;
}

export const NEWS_CATEGORIES = [
  "All",
  "Top Trending Stocks Today",
  "Geopolitics / Policy",
  "Macro",
  "Fed / Rates",
  "Inflation",
  "Earnings",
  "Technology",
  "AI",
  "Semiconductors",
  "Energy",
  "Market sentiment",
  "Other",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NEWS_SOURCES = [
  { value: "all", label: "Todas las fuentes" },
  { value: "yahoo", label: "Yahoo Finance" },
  { value: "google", label: "Google News" },
] as const;

export type NewsSource = (typeof NEWS_SOURCES)[number]["value"];
