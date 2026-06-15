import { useNavigate } from "react-router-dom";
import { useSymbolStore } from "@/stores/symbolStore";
import { useAiChatStore } from "@/features/aiChat/aiChatStore";
import { showToast } from "@/components/ui/toastStore";

/** Explicación basada en reglas del entorno de mercado (sin llamadas a IA). */
export function WhatThisMeansPanel({ bullets }: { bullets: string[] }) {
  const navigate = useNavigate();
  const activeSymbol = useSymbolStore((s) => s.activeSymbol);
  const openWithPrefill = useAiChatStore((s) => s.openWithPrefill);

  const askAi = () => {
    if (!activeSymbol) {
      showToast("Selecciona una acción para preguntar a la IA sobre el mercado", "info");
      navigate("/");
      return;
    }
    navigate("/");
    void openWithPrefill(
      activeSymbol,
      "¿Cómo está el mercado hoy según la inteligencia de mercado y qué implica para esta acción?"
    );
  };

  return (
    <section
      data-testid="what-this-means-panel"
      className="rounded-lg border border-edge bg-panel p-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-100">Qué significa esto</h2>
        <button
          onClick={askAi}
          data-testid="ask-ai-explain"
          className="rounded-full border border-edge bg-panel-2 px-2.5 py-0.5 text-[10px] text-accent hover:bg-panel-3"
        >
          ✨ Preguntar a la IA
        </button>
      </div>
      {bullets.length === 0 ? (
        <p className="text-xs text-muted">Sin lectura del mercado por ahora.</p>
      ) : (
        <ul className="space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-xs text-gray-300">
              <span aria-hidden className="text-accent">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[9px] text-muted">
        Lectura heurística del mercado; combínala con el Scorecard de cada acción.
        No es asesoría financiera.
      </p>
    </section>
  );
}
