// Generador de prompts para ChatGPT a partir del contexto real del ticker.
// El contexto viene del backend (GET /api/chatgpt/context) — sin OpenAI,
// sin escribir en SQL. El prompt resultante lo copia el usuario a SU ChatGPT.

import { apiClient } from "@/services/apiClient";
import type { ChannelRiskRewardResult } from "@/features/channelRiskReward/channelRiskRewardTypes";
import {
  CONFIDENCE_LABEL,
  OVERALL_VIEW_LABEL,
  RISK_LABEL,
  scorecardKeyMetricsLines,
  type StockScorecardResponse,
} from "@/features/stockScorecard/stockScorecardTypes";
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
  market_context_analysis: [
    "Cómo está el entorno de mercado hoy (índices, volatilidad y sentimiento)",
    "Si el mercado general apoya o no una entrada en este instrumento ahora",
    "Qué riesgos de mercado podrían afectar esta acción",
    "Cómo combinar el contexto de mercado con la lectura técnica de la acción",
    "Preguntas que debería investigar antes de actuar",
  ],
  macro_market_stock_decision: [
    "Explica el telón de fondo macro actual (tasas, inflación, curva de rendimientos)",
    "Conecta ese contexto macro con esta acción en concreto",
    "Identifica los principales riesgos macro y de mercado para esta acción",
    "Qué señales confirmarían o invalidarían la tesis (sin afirmaciones garantizadas)",
    "Un marco de decisión paso a paso combinando macro + mercado + técnico",
  ],
  portfolio_analysis: [
    "Evalúa qué tan diversificado está el portafolio",
    "Identifica los riesgos de concentración (posiciones y sectores)",
    "Señala qué posiciones ayudan o perjudican el desempeño",
    "Compara el desempeño del portafolio con el mercado",
    "Qué debería vigilar (sin asesoría de compra/venta garantizada)",
  ],
};

/** Contexto compacto de Inteligencia de Mercado para el prompt de ChatGPT. */
export interface MarketIntelligencePromptContext {
  sentiment?: { score: number | null; label: string; confidence: string } | null;
  vix?: number | null;
  indices?: Array<{ symbol: string; changePercent: number | null; trend: string }>;
  topGainer?: string | null;
  topLoser?: string | null;
  topNews?: Array<string | null>;
  whatThisMeans?: string[];
}

/** Contexto compacto del portafolio para el prompt de ChatGPT. */
export interface PortfolioPromptContext {
  name?: string | null;
  totalCost?: number | null;
  currentValue?: number | null;
  totalGainLossPercent?: number | null;
  positionCount?: number | null;
  riskLevel?: string | null;
  largestPosition?: string | null;
  largestPositionWeight?: number | null;
  top3Weight?: number | null;
  benchmarkAlpha?: number | null;
  topPositions?: Array<{ ticker: string; weight: number | null; gainLossPercent: number | null }>;
  recommendations?: string[];
}

/** Contexto compacto del Macro Dashboard para el prompt de ChatGPT. */
export interface MacroPromptContext {
  riskLevel?: string | null;
  riskLabel?: string | null;
  summary?: string | null;
  curveStatus?: string | null;
  inflationTrend?: string | null;
  fedFundsDisplay?: string | null;
  treasury10YDisplay?: string | null;
  calendar?: Array<{ eventName: string; date: string | null; impact: string }>;
  whatThisMeans?: string[];
}

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
  channelTimeframe?: string | null,
  /** Workspace de análisis activo (nombre + seis slots range/interval). */
  workspace?: {
    name: string;
    chartContext: { slotId: string; range: string; interval: string }[];
  } | null,
  /** Stock Scorecard del símbolo (si el toggle está activo y ya se calculó). */
  scorecard?: StockScorecardResponse | null,
  /** Inteligencia de mercado (si el toggle está activo y ya se cargó). */
  marketIntelligence?: MarketIntelligencePromptContext | null,
  /** Contexto macro (si el toggle está activo y ya se cargó). */
  macro?: MacroPromptContext | null,
  /** Contexto de portafolio (si el toggle está activo y ya se cargó). */
  portfolio?: PortfolioPromptContext | null
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

  // Planes de posición (cajas Long/Short). Por defecto se incluyen cuando hay;
  // el toggle solo puede desactivarlos explícitamente (false).
  const plans = context.positionPlans ?? [];
  if (toggles.includePositionPlans !== false && plans.length > 0) {
    lines.push("");
    lines.push(
      "Mis planes de posición / cajas de riesgo-beneficio (planificación hipotética, no son operaciones ejecutadas):"
    );
    for (const p of plans.slice(0, 10)) {
      const kind = p.type === "LONG_POSITION" ? "Long" : "Short";
      const rr = p.riskRewardRatio != null ? `${p.riskRewardRatio.toFixed(2)} : 1` : "n/d";
      const tf = p.sourceTimeframe ? ` [${p.sourceTimeframe}]` : "";
      const notes = p.notes ? ` · notas: ${p.notes}` : "";
      lines.push(
        `- ${kind}${tf}: entrada ${fmt(p.entryPrice)}, objetivo ${fmt(p.targetPrice)}, stop ${fmt(p.stopPrice)}` +
          ` · cantidad ${fmt(p.quantity, 0)} · R/R ${rr}` +
          ` · riesgo ${fmt(p.riskPercent)}% (${fmt(p.riskAmount)}), beneficio ${fmt(p.rewardPercent)}% (${fmt(p.rewardAmount)})${notes}`
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

  if (workspace) {
    lines.push("");
    lines.push(`Workspace de análisis activo: ${workspace.name}`);
    lines.push(
      `Configuración de las seis gráficas: ${workspace.chartContext
        .map((s, i) => `Chart ${i + 1} = ${s.range}/${s.interval}`)
        .join(", ")}`
    );
  }

  if (toggles.includeScorecard && scorecard) {
    const n = (v: number | null) => (v === null ? "n/d" : String(v));
    lines.push("");
    lines.push("Stock Scorecard (heurístico, datos disponibles):");
    lines.push(`- Vista general: ${OVERALL_VIEW_LABEL[scorecard.overallView]}`);
    lines.push(
      `- Puntajes — General: ${n(scorecard.overallScore)}, Técnico: ${n(
        scorecard.technicalScore
      )}, Fundamental: ${n(scorecard.fundamentalScore)}, Noticias: ${n(
        scorecard.newsScore
      )}, Sentimiento: ${n(scorecard.sentimentScore)}`
    );
    lines.push(
      `- Riesgo: ${RISK_LABEL[scorecard.riskLevel]} · Confianza: ${
        CONFIDENCE_LABEL[scorecard.confidenceLevel]
      }`
    );
    if (scorecard.strengths.length) {
      lines.push(`- Fortalezas: ${scorecard.strengths.join("; ")}`);
    }
    if (scorecard.risks.length) {
      lines.push(`- Riesgos: ${scorecard.risks.join("; ")}`);
    }
    if (scorecard.watchItems.length) {
      lines.push(`- A vigilar: ${scorecard.watchItems.join("; ")}`);
    }
    if (toggles.includeScorecardMetrics) {
      const metricLines = scorecardKeyMetricsLines(scorecard);
      if (metricLines.length) {
        lines.push("Métricas detalladas:");
        lines.push(...metricLines);
      }
    }
  }

  if (toggles.includeMarketIntelligence && marketIntelligence) {
    const mi = marketIntelligence;
    lines.push("");
    lines.push("Inteligencia de mercado de hoy (entorno general, no señal de compra/venta):");
    if (mi.sentiment && mi.sentiment.score != null) {
      lines.push(
        `- Sentimiento (proxy Fear & Greed): ${mi.sentiment.score}/100 (${mi.sentiment.label}, confianza ${mi.sentiment.confidence})`
      );
    }
    if (mi.vix != null) lines.push(`- VIX: ${fmt(mi.vix)}`);
    if (mi.indices?.length) {
      const trends = mi.indices
        .filter((i) => i.changePercent != null)
        .slice(0, 6)
        .map((i) => `${i.symbol} ${i.changePercent! >= 0 ? "+" : ""}${i.changePercent!.toFixed(2)}%`)
        .join(", ");
      if (trends) lines.push(`- Índices: ${trends}`);
    }
    if (mi.topGainer || mi.topLoser) {
      lines.push(
        `- Movers: mayor subida ${mi.topGainer ?? "n/d"}, mayor caída ${mi.topLoser ?? "n/d"}`
      );
    }
    const headlines = (mi.topNews ?? []).filter(Boolean).slice(0, 3);
    if (headlines.length) {
      lines.push("- Titulares de mercado:");
      for (const h of headlines) lines.push(`  · ${h}`);
    }
    if (mi.whatThisMeans?.length) {
      lines.push("- Qué significa: " + mi.whatThisMeans.slice(0, 3).join(" | "));
    }
  }

  if (toggles.includePortfolio && portfolio) {
    lines.push("");
    lines.push("Portafolio del usuario (informativo, no es asesoría):");
    if (portfolio.name) lines.push(`- Nombre: ${portfolio.name}`);
    lines.push(
      `- Valor: ${portfolio.currentValue ?? "n/d"} · P/L ${portfolio.totalGainLossPercent ?? "n/d"}% · `
      + `${portfolio.positionCount ?? 0} posiciones · riesgo ${portfolio.riskLevel ?? "n/d"}`
    );
    if (portfolio.largestPosition) {
      lines.push(
        `- Mayor posición: ${portfolio.largestPosition} (${portfolio.largestPositionWeight ?? "?"}%) · `
        + `top3 ${portfolio.top3Weight ?? "?"}%`
      );
    }
    if (portfolio.benchmarkAlpha != null) lines.push(`- Alpha vs S&P 500: ${portfolio.benchmarkAlpha}%`);
    for (const p of (portfolio.topPositions ?? []).slice(0, 6)) {
      lines.push(`  · ${p.ticker}: ${p.weight ?? "?"}% · P/L ${p.gainLossPercent ?? "?"}%`);
    }
    for (const r of (portfolio.recommendations ?? []).slice(0, 4)) {
      lines.push(`- Alerta: ${r}`);
    }
  }

  if (toggles.includeMacro && macro) {
    lines.push("");
    lines.push("Contexto macro de hoy (entorno general, no señal de compra/venta):");
    if (macro.riskLabel) {
      lines.push(`- Riesgo macro: ${macro.riskLabel}${macro.riskLevel ? ` (${macro.riskLevel})` : ""}`);
    }
    if (macro.summary) lines.push(`- Resumen: ${macro.summary}`);
    if (macro.curveStatus) lines.push(`- Curva de rendimientos: ${macro.curveStatus}`);
    if (macro.inflationTrend) lines.push(`- Tendencia de inflación: ${macro.inflationTrend}`);
    if (macro.fedFundsDisplay) lines.push(`- Tasa de la Fed: ${macro.fedFundsDisplay}`);
    if (macro.treasury10YDisplay) lines.push(`- Tesoro 10 años: ${macro.treasury10YDisplay}`);
    const evs = (macro.calendar ?? []).slice(0, 3);
    if (evs.length) {
      lines.push("- Próximos eventos macro:");
      for (const e of evs) lines.push(`  · ${e.eventName}${e.date ? ` (${e.date})` : ""} [${e.impact}]`);
    }
    if (macro.whatThisMeans?.length) {
      lines.push("- Qué significa: " + macro.whatThisMeans.slice(0, 3).join(" | "));
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
