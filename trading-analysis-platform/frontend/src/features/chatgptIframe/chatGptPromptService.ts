// Generador de prompts para ChatGPT a partir del contexto real del ticker.
// El contexto viene del backend (GET /api/chatgpt/context) — sin OpenAI,
// sin escribir en SQL. El prompt resultante lo copia el usuario a SU ChatGPT.

import { apiClient } from "@/services/apiClient";
import type { ChannelRiskRewardResult } from "@/features/channelRiskReward/channelRiskRewardTypes";
import type {
  ChatGptContext,
  ChatGptContextToggles,
  ChatGptPromptType,
} from "./chatGptIframeTypes";

export function fetchChatGptContext(symbol: string): Promise<ChatGptContext> {
  const q = new URLSearchParams({ symbol });
  return apiClient.get(`/chatgpt/context?${q.toString()}`);
}

const REQUESTS: Record<ChatGptPromptType, string[]> = {
  general_analysis: [
    "Una lectura general del instrumento y su momento actual",
    "Contexto de la empresa/instrumento y su sector",
    "Escenario alcista y escenario bajista",
    "Niveles clave a vigilar",
    "Preguntas que debería investigar más a fondo",
  ],
  technical_analysis: [
    "Lectura de la tendencia actual",
    "Escenario alcista",
    "Escenario bajista",
    "Niveles clave a vigilar",
    "Zona de riesgo/invalidación",
    "Preguntas que debería investigar más a fondo",
  ],
  news_catalysts: [
    "Qué noticias o catalizadores recientes podrían estar moviendo el precio",
    "Próximos eventos relevantes (resultados, dividendos, macro)",
    "Cómo podrían afectar los escenarios alcista/bajista",
    "Si no tienes información actualizada, dime explícitamente qué buscar y dónde",
  ],
  bullish_bearish: [
    "Escenario alcista detallado: condiciones, confirmación y objetivo",
    "Escenario bajista detallado: condiciones, confirmación y objetivo",
    "Qué señales confirmarían o invalidarían cada escenario",
    "Probabilidad relativa que asignas a cada escenario y por qué",
  ],
  risk_analysis: [
    "Principales riesgos técnicos en este momento",
    "Riesgos fundamentales/sectoriales a considerar",
    "Zona de invalidación y cómo definir un nivel de riesgo razonable",
    "Errores comunes que debería evitar en este tipo de configuración",
  ],
  support_resistance: [
    "Soportes relevantes con su justificación",
    "Resistencias relevantes con su justificación",
    "Qué nivel es el más importante ahora mismo y por qué",
    "Cómo cambiaría la lectura si se pierde el soporte principal",
  ],
  sector_comparison: [
    "Con qué ETFs o índices conviene comparar este instrumento",
    "Cómo se ve su fuerza relativa frente al sector",
    "Alternativas del mismo sector que convendría vigilar",
    "Qué diría una rotación sectorial sobre este instrumento",
  ],
  drawings_review: [
    "Revisión de cada uno de mis dibujos: ¿son niveles razonables?",
    "Qué dibujos parecen más relevantes para el precio actual",
    "Qué niveles me faltan por marcar",
    "Cómo usar mis dibujos para definir confirmación e invalidación",
  ],
};

function fmt(value: number | null | undefined, digits = 2): string {
  return value == null ? "n/d" : value.toFixed(digits);
}

/** "(precio 2.7% por encima/debajo)" respecto a un nivel de referencia. */
function vsPrice(price: number | null | undefined, level: number | null | undefined): string {
  if (price == null || level == null || level === 0) return "";
  const pct = ((price - level) / level) * 100;
  const dir = pct >= 0 ? "por encima" : "por debajo";
  return ` (precio ${Math.abs(pct).toFixed(1)}% ${dir})`;
}

function fmtVolume(value: number | null | undefined): string {
  if (value == null) return "n/d";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

export function buildChatGptPrompt(
  type: ChatGptPromptType,
  context: ChatGptContext,
  toggles: ChatGptContextToggles,
  channelRR?: ChannelRiskRewardResult | null,
  /** Temporalidad del canal AUTO-detectado (la deteccion es por preset). */
  channelTimeframe?: string | null
): string {
  const lines: string[] = [];
  const symbol = context.symbol;

  lines.push(`Estoy analizando ${symbol} en mi plataforma personal de análisis técnico.`);
  lines.push("");
  lines.push("Analiza este instrumento usando el contexto de abajo.");
  lines.push("");
  lines.push(`Ticker: ${symbol}`);
  if (context.yahooSymbol && context.yahooSymbol !== symbol) {
    lines.push(`Símbolo Yahoo: ${context.yahooSymbol}`);
  }

  const inst = context.instrument;
  if (inst && (inst.name || inst.exchange || inst.sector)) {
    lines.push("");
    lines.push("Instrumento:");
    if (inst.name) lines.push(`- Nombre: ${inst.name}`);
    if (inst.exchange) lines.push(`- Exchange: ${inst.exchange}`);
    if (inst.currency) lines.push(`- Moneda: ${inst.currency}`);
    if (inst.sector) lines.push(`- Sector: ${inst.sector}`);
    if (inst.industry) lines.push(`- Industria: ${inst.industry}`);
  }

  const price = context.quote?.price ?? null;

  if (toggles.includePriceSummary) {
    lines.push("");
    lines.push(
      `Resumen de mercado actual${context.asOf ? ` (datos al cierre del ${context.asOf})` : ""}:`
    );
    if (price != null) {
      lines.push(
        `- Último precio: ${fmt(price)} ${context.quote?.currency ?? ""}`.trimEnd()
      );
      lines.push(
        `- Cambio del día: ${fmt(context.quote?.change)} (${fmt(context.quote?.changePercent)}%)`
      );
    } else {
      lines.push("- Precio actual: no disponible en este momento");
    }
    const d = context.dailySummary;
    if (d) {
      lines.push(
        `- Máximo anual: ${fmt(d.yearHigh)}${vsPrice(price, d.yearHigh)} / Mínimo anual: ${fmt(d.yearLow)}${vsPrice(price, d.yearLow)}`
      );
      lines.push(`- Rango 20 días: ${fmt(d.low20d)} – ${fmt(d.high20d)}`);
      if (d.changePercent20d != null) {
        lines.push(`- Cambio 20 días: ${fmt(d.changePercent20d)}%`);
      }
    }
    const w = context.weeklySummary;
    if (w && w.lastClose != null) {
      lines.push(
        `- Contexto semanal (4 años): cierre ${fmt(w.lastClose)}, RSI14 semanal ${fmt(w.rsi14w)}, SMA 10 semanas ${fmt(w.sma10w)}, SMA 40 semanas ${fmt(w.sma40w)}${vsPrice(price, w.sma40w)}`
      );
    }
  }

  if (toggles.includeIndicators) {
    const v = context.indicatorValues ?? {};
    const keys = Object.keys(v);
    if (keys.length > 0) {
      lines.push("");
      lines.push(
        "Contexto técnico (calculado por mi plataforma sobre cierres diarios REALES de Yahoo Finance, con histórico extendido para precisión; RSI con suavizado de Wilder):"
      );
      if (v.sma20 != null) lines.push(`- SMA 20: ${fmt(v.sma20)}${vsPrice(price, v.sma20)}`);
      if (v.sma50 != null) lines.push(`- SMA 50: ${fmt(v.sma50)}${vsPrice(price, v.sma50)}`);
      if (v.sma200 != null) lines.push(`- SMA 200: ${fmt(v.sma200)}${vsPrice(price, v.sma200)}`);
      if (v.ema9 != null) lines.push(`- EMA 9: ${fmt(v.ema9)}${vsPrice(price, v.ema9)}`);
      if (v.ema21 != null) lines.push(`- EMA 21: ${fmt(v.ema21)}${vsPrice(price, v.ema21)}`);
      if (v.rsi14 != null) lines.push(`- RSI 14: ${fmt(v.rsi14)}`);
      if (v.macd != null) {
        lines.push(
          `- MACD (12,26,9): línea ${fmt(v.macd, 3)}, señal ${fmt(v.macdSignal, 3)}, histograma ${fmt(v.macdHist, 3)}`
        );
      }
      if (v.bbUpper != null) {
        lines.push(
          `- Bandas de Bollinger (20, 2σ): superior ${fmt(v.bbUpper)} / media ${fmt(v.bbMiddle)} / inferior ${fmt(v.bbLower)}`
        );
      }
      if (v.volumeLast != null) {
        const ratio =
          v.volumeAvg20 != null && v.volumeAvg20 > 0
            ? ` (x${(v.volumeLast / v.volumeAvg20).toFixed(2)} vs promedio 20d ${fmtVolume(v.volumeAvg20)})`
            : "";
        lines.push(`- Volumen última sesión: ${fmtVolume(v.volumeLast)}${ratio}`);
      }

      // Indicadores con los parametros EXACTOS que el usuario configuro.
      const cfg = context.configuredValues ?? {};
      const cfgKeys = Object.keys(cfg);
      if (cfgKeys.length > 0) {
        lines.push("Mis indicadores configurados en la plataforma (mismos parámetros que veo en pantalla):");
        for (const key of cfgKeys) {
          const value = cfg[key];
          if (typeof value === "number") {
            lines.push(`- ${key}: ${fmt(value)}${vsPrice(price, value)}`);
          } else if (value && typeof value === "object") {
            const parts = Object.entries(value)
              .filter(([, n]) => n != null)
              .map(([k, n]) => `${k} ${fmt(n as number, 3)}`);
            if (parts.length > 0) lines.push(`- ${key}: ${parts.join(", ")}`);
          }
        }
      }
    }
  }

  if (toggles.includeDrawings) {
    const drawings = context.drawings ?? [];
    lines.push("");
    if (drawings.length > 0) {
      lines.push("Mis dibujos visibles en la gráfica (fecha @ precio de cada punto):");
      for (const d of drawings.slice(0, 20)) {
        const points = (d.points ?? [])
          .filter((p) => p.price != null)
          .map((p) => (p.date ? `${p.date} @ ${fmt(p.price)}` : fmt(p.price)))
          .join(" → ");
        const label = d.name ? ` "${d.name}"` : "";
        const comment = d.comment ? ` (${d.comment})` : "";
        lines.push(`- ${d.sourceTimeframe} ${d.type}${label}: ${points}${comment}`);
      }
    } else {
      lines.push("Mis dibujos: no tengo dibujos en este ticker todavía.");
    }
  }

  const w = context.watchlist;
  if ((toggles.includeWatchlistNotes || toggles.includeFavoriteStatus) && w) {
    lines.push("");
    lines.push("Contexto de mi watchlist:");
    if (toggles.includeFavoriteStatus) {
      lines.push(`- Favorito: ${w.favorite ? "Sí" : "No"}`);
    }
    if (toggles.includeWatchlistNotes) {
      if (w.tags && w.tags.length > 0) lines.push(`- Tags: ${w.tags.join(", ")}`);
      if (w.notes) lines.push(`- Notas: ${w.notes}`);
    }
  }

  const news = context.recentNews ?? [];
  if (news.length > 0) {
    lines.push("");
    lines.push("Titulares recientes del instrumento (no inventes más noticias):");
    for (const n of news.slice(0, 5)) {
      if (!n.title) continue;
      const meta = [n.publisher, n.publishedAt?.slice(0, 10)].filter(Boolean).join(", ");
      lines.push(`- ${n.title}${meta ? ` (${meta})` : ""}`);
    }
  }

  const globalNews = context.recentGlobalMarketNews ?? [];
  const trendingNews = context.topTrendingStocksTodayNews ?? [];
  if (globalNews.length > 0 || trendingNews.length > 0) {
    lines.push("");
    lines.push("Contexto de mercado reciente (no inventes más noticias):");
    for (const n of globalNews.slice(0, 3)) {
      if (n.title) lines.push(`- ${n.title}${n.publisher ? ` (${n.publisher})` : ""}`);
    }
    if (trendingNews.length > 0) {
      lines.push("Acciones en movimiento hoy:");
      for (const n of trendingNews.slice(0, 3)) {
        if (n.title) lines.push(`- ${n.title}${n.publisher ? ` (${n.publisher})` : ""}`);
      }
    }
  }

  const sims = context.simulatedEntries ?? [];
  if (sims.length > 0) {
    lines.push("");
    lines.push("Mis entradas simuladas (paper trading, hipotéticas):");
    for (const s of sims.slice(0, 10)) {
      const result =
        s.gainLossPercent != null
          ? ` · resultado ${s.gainLossPercent >= 0 ? "+" : ""}${s.gainLossPercent.toFixed(2)}%`
          : "";
      const current =
        s.currentPrice != null
          ? ` · ${s.status === "CERRADA" ? "salida" : "precio actual"} ${fmt(s.currentPrice)}`
          : "";
      const days = s.daysSinceEntry != null ? ` · ${s.daysSinceEntry} día(s)` : "";
      const notes = s.notes ? ` · notas: ${s.notes}` : "";
      lines.push(
        `- ${s.type} (${s.status}) entrada ${fmt(s.entryPrice)} el ${s.entryDate.slice(0, 10)}${current}${result}${days}${notes}`
      );
    }
  }

  if (channelRR) {
    lines.push("");
    lines.push(
      `Riesgo/beneficio de canal (hipotético, AUTO-detectado sobre mis líneas${channelTimeframe ? ` de la temporalidad ${channelTimeframe}` : ""}):`
    );
    lines.push(
      `- Referencia: ${channelRR.referenceType === "simulated_entry" ? "entrada simulada" : "precio actual"} @ ${fmt(channelRR.referencePrice)}`
    );
    lines.push(`- Canal superior: ${fmt(channelRR.upperChannelPrice)}`);
    lines.push(`- Canal inferior: ${fmt(channelRR.lowerChannelPrice)}`);
    if (channelRR.invalidReason) {
      lines.push(`- No calculable: ${channelRR.invalidReason}`);
    } else {
      lines.push(`- Beneficio potencial: +${fmt(channelRR.potentialRewardPercent)}%`);
      lines.push(`- Riesgo potencial: -${fmt(channelRR.potentialRiskPercent)}%`);
      lines.push(`- Ratio R/R: ${fmt(channelRR.ratio)} : 1`);
    }
  }

  if (toggles.includeTimeframeSummary && context.timeframes?.length) {
    lines.push("");
    lines.push(
      `Temporalidades que uso en el dashboard: ${context.timeframes
        .map((t) => t.key)
        .join(", ")}`
    );
  }

  lines.push("");
  lines.push("Por favor dame:");
  REQUESTS[type].forEach((req, i) => lines.push(`${i + 1}. ${req}`));

  lines.push("");
  lines.push(
    "Importante: esto es solo análisis informativo. No lo presentes como asesoría financiera garantizada, no inventes noticias ni datos que no tengas, y distingue hechos de interpretación."
  );

  return lines.join("\n");
}
