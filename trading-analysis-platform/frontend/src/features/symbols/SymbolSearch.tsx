import { useState } from "react";
import { useSymbolStore } from "@/stores/symbolStore";
import { Spinner } from "@/components/ui/Spinner";

/** Barra superior para buscar tickers. Consulta el backend (yfinance). */
export function SymbolSearch() {
  const [query, setQuery] = useState("");
  const searchSymbol = useSymbolStore((s) => s.searchSymbol);
  const searching = useSymbolStore((s) => s.searching);
  const searchError = useSymbolStore((s) => s.searchError);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const info = await searchSymbol(q);
    if (info) setQuery("");
  };

  return (
    <form onSubmit={submit} className="relative flex items-center gap-2">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          placeholder="Buscar ticker (AAPL, TSLA, NVDA…)"
          className="w-72 rounded border border-edge bg-panel-2 px-3 py-1.5 text-sm text-gray-100 placeholder:text-muted focus:border-accent focus:outline-none"
          spellCheck={false}
          autoComplete="off"
        />
        {searching && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Spinner size={14} />
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={searching}
        className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        Buscar
      </button>
      {searchError && (
        <span className="absolute left-0 top-full mt-1 text-[11px] text-down">{searchError}</span>
      )}
    </form>
  );
}
