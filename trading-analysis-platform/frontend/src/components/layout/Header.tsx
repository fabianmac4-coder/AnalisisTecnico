import { Link, useNavigate } from "react-router-dom";
import { SymbolSearch } from "@/features/symbols/SymbolSearch";
import { AiChatButton } from "@/features/aiChat/AiChatButton";
import { ChatGptIframeButton } from "@/features/chatgptIframe/ChatGptIframeButton";
import { RefreshButton } from "@/features/refresh/RefreshButton";
import { AutoRefreshMenu } from "@/features/refresh/AutoRefreshMenu";
import { useLayoutStore } from "@/stores/layoutStore";
import { useChartStore } from "@/stores/chartStore";
import { useSymbolStore } from "@/stores/symbolStore";
import { useStockScorecardStore, selectScorecard } from "@/features/stockScorecard/stockScorecardStore";
import { useAuthStore } from "@/features/auth/authStore";
import { resolveDisplayPrice } from "@/features/charting/priceResolver";
import { formatInstrumentDisplayName } from "@/features/symbols/instrumentName";
import { formatPrice, formatPercent } from "@/utils/formatters";

/** Header superior: marca propia, buscador, precio canonico, usuario. */
export function Header() {
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const activeSymbol = useChartStore((s) => s.activeSymbol);
  const quote = useChartStore((s) => (activeSymbol ? s.quoteBySymbol[activeSymbol] : undefined));
  const chartDataByPreset = useChartStore((s) => s.chartDataByPreset);
  // Nombre del instrumento: catálogo (búsqueda) o, si falta, el scorecard del
  // símbolo activo (Yahoo longName). El header muestra "TICKER · Nombre".
  const catalog = useSymbolStore((s) => s.catalog);
  const scorecardName = useStockScorecardStore((s) =>
    activeSymbol ? selectScorecard(s, activeSymbol)?.companyName : undefined
  );
  const catalogName = activeSymbol
    ? catalog.find((c) => c.symbol === activeSymbol)?.name
    : undefined;
  const instrumentDisplay = activeSymbol
    ? formatInstrumentDisplayName(activeSymbol, catalogName, scorecardName)
    : "";
  const { price } = resolveDisplayPrice(quote, chartDataByPreset);
  const change = quote?.change ?? null;
  const changePct = quote?.changePercent ?? null;
  // Verde si sube, rojo si baja, gris neutro si 0 o sin datos.
  const changeClass =
    change == null || change === 0 ? "text-muted" : change > 0 ? "text-up" : "text-down";

  return (
    <header className="flex items-center gap-4 border-b border-edge bg-panel px-3 py-2">
      <button
        onClick={toggleSidebar}
        className="rounded px-2 py-1 text-muted hover:bg-panel-3"
        title="Mostrar/ocultar catálogo"
      >
        ☰
      </button>
      <div className="flex items-center gap-2">
        <span className="text-lg">📊</span>
        <span className="text-sm font-bold tracking-tight text-gray-100">Análisis Técnico</span>
      </div>

      <SymbolSearch />

      {activeSymbol && (
        <div className="flex items-center gap-2 text-sm">
          <span
            className="max-w-[20rem] truncate font-semibold text-gray-100"
            title={instrumentDisplay}
            data-testid="active-instrument-name"
          >
            {instrumentDisplay}
          </span>
          {price !== null && (
            <span className={`font-mono ${changeClass}`}>
              {formatPrice(price, quote?.currency)}
            </span>
          )}
          {change !== null && changePct !== null && (
            <span className={`text-xs ${changeClass}`}>
              {change > 0 ? "+" : ""}
              {change.toFixed(2)} ({formatPercent(changePct)})
            </span>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Link
          to="/news"
          data-testid="news-link"
          title="Noticias de mercado y geopolítica"
          className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
        >
          📰 Noticias
        </Link>
        <Link
          to="/market-movers"
          data-testid="movers-link"
          title="Tendencia, subidas, caídas y más activas"
          className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
        >
          🚀 Movers
        </Link>
        <Link
          to="/market-intelligence"
          data-testid="market-intelligence-link"
          title="Inteligencia de mercado: índices, sentimiento y resumen"
          className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
        >
          🧠 Inteligencia
        </Link>
        <Link
          to="/macro"
          data-testid="macro-link"
          title="Macro: tasas, inflación, empleo, curva y mercados globales"
          className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
        >
          🌐 Macro
        </Link>
        <Link
          to="/portfolio"
          data-testid="portfolio-link"
          title="Portafolio: posiciones, valor, asignación y riesgo de concentración"
          className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
        >
          💼 Portafolio
        </Link>
        <RefreshButton />
        <AutoRefreshMenu />
        <AiChatButton />
        <ChatGptIframeButton />
        {authUser?.esAdmin && (
          <Link
            to="/admin/users"
            data-testid="admin-link"
            className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
          >
            ⚙ Usuarios
          </Link>
        )}
        {authUser && (
          <Link
            to="/account"
            data-testid="account-link"
            title={`Mi cuenta${authUser.email ? ` (${authUser.email})` : ""}`}
            className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
          >
            👤 {authUser.nombreUsuario}
          </Link>
        )}
        <button
          onClick={onLogout}
          title="Cerrar sesión"
          className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-muted hover:bg-red-500/10 hover:text-red-400"
        >
          Salir
        </button>
      </div>
    </header>
  );
}
