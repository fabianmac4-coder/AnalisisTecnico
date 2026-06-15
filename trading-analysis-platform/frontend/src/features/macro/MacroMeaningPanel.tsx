import { useNavigate } from "react-router-dom";
import { useSymbolStore } from "@/stores/symbolStore";
import { useAiChatStore } from "@/features/aiChat/aiChatStore";
import { showToast } from "@/components/ui/toastStore";

/** "Qué significa esto para inversionistas": explicación basada en reglas. */
export function MacroMeaningPanel({ bullets }: { bullets: string[] }) {
  const navigate = useNavigate();
  const activeSymbol = useSymbolStore((s) => s.activeSymbol);
  const openWithPrefill = useAiChatStore((s) => s.openWithPrefill);

  const askAi = () => {
    if (!activeSymbol) {
      showToast("Selecciona una acción para preguntar a la IA sobre el macro", "info");
      navigate("/");
      return;
    }
    navigate("/");
    void openWithPrefill(
      activeSymbol,
      "¿Cómo está el entorno macro (tasas, inflación, curva) y qué implica para esta acción?"
    );
  };

  return (
    <section
      data-testid="macro-meaning-panel"
      className="rounded-lg border border-edge bg-panel p-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-100">
          Qué significa esto para inversionistas
        </h2>
        <button
          onClick={askAi}
          data-testid="macro-ask-ai"
          className="rounded-full border border-edge bg-panel-2 px-2.5 py-0.5 text-[10px] text-accent hover:bg-panel-3"
        >
          ✨ Preguntar a la IA
        </button>
      </div>
      {bullets.length === 0 ? (
        <p className="text-xs text-muted">Sin lectura macro por ahora.</p>
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
        Lectura macro heurística; combínala con el Scorecard y el análisis técnico.
        No es asesoría financiera.
      </p>
    </section>
  );
}
