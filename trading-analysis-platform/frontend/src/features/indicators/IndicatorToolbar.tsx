import { useState } from "react";
import { useLayoutStore } from "@/stores/layoutStore";
import {
  validateIndicatorParams,
  type GlobalIndicatorConfig,
  type IndicatorType,
} from "./globalIndicators";

// ---------------------------------------------------------------------------
// Definicion declarativa de los campos editables por tipo de indicador.
// ---------------------------------------------------------------------------

type FieldKind = "int" | "float" | "source" | "color" | "bool";

interface FieldDef {
  kind: FieldKind;
  label: string;
  /** "params.period" o "style.color". */
  path: `params.${string}` | `style.${string}`;
  min?: number;
  max?: number;
  step?: number;
}

const SOURCES = ["close", "open", "high", "low", "hl2", "hlc3", "ohlc4"];

const FIELDS: Record<IndicatorType, FieldDef[]> = {
  SMA: [
    { kind: "int", label: "Periodo", path: "params.period", min: 1 },
    { kind: "source", label: "Fuente", path: "params.source" },
    { kind: "color", label: "Color", path: "style.color" },
    { kind: "int", label: "Grosor", path: "style.lineWidth", min: 1, max: 4 },
  ],
  EMA: [
    { kind: "int", label: "Periodo", path: "params.period", min: 1 },
    { kind: "source", label: "Fuente", path: "params.source" },
    { kind: "color", label: "Color", path: "style.color" },
    { kind: "int", label: "Grosor", path: "style.lineWidth", min: 1, max: 4 },
  ],
  BBANDS: [
    { kind: "int", label: "Periodo", path: "params.period", min: 1 },
    { kind: "float", label: "Desv. std", path: "params.stdDev", min: 0.1, step: 0.1 },
    { kind: "source", label: "Fuente", path: "params.source" },
    { kind: "color", label: "Banda sup.", path: "style.color" },
    { kind: "color", label: "Media", path: "style.secondaryColor" },
    { kind: "color", label: "Banda inf.", path: "style.tertiaryColor" },
    { kind: "int", label: "Grosor", path: "style.lineWidth", min: 1, max: 4 },
  ],
  VOLUME: [
    { kind: "bool", label: "Color por dirección", path: "params.colorByCandleDirection" },
    { kind: "color", label: "Alcista", path: "style.histogramPositiveColor" },
    { kind: "color", label: "Bajista", path: "style.histogramNegativeColor" },
    { kind: "float", label: "Opacidad", path: "style.opacity", min: 0.05, max: 1, step: 0.05 },
  ],
  RSI: [
    { kind: "int", label: "Periodo", path: "params.period", min: 2 },
    { kind: "source", label: "Fuente", path: "params.source" },
    { kind: "int", label: "Sobrecompra", path: "params.overbought", min: 50, max: 100 },
    { kind: "int", label: "Sobreventa", path: "params.oversold", min: 0, max: 50 },
    { kind: "color", label: "Color", path: "style.color" },
  ],
  MACD: [
    { kind: "int", label: "Rápida", path: "params.fastPeriod", min: 1 },
    { kind: "int", label: "Lenta", path: "params.slowPeriod", min: 1 },
    { kind: "int", label: "Señal", path: "params.signalPeriod", min: 1 },
    { kind: "source", label: "Fuente", path: "params.source" },
    { kind: "color", label: "MACD", path: "style.color" },
    { kind: "color", label: "Señal", path: "style.secondaryColor" },
    { kind: "color", label: "Hist. +", path: "style.histogramPositiveColor" },
    { kind: "color", label: "Hist. −", path: "style.histogramNegativeColor" },
  ],
};

type Draft = { params: Record<string, number | string | boolean>; style: Record<string, string | number> };

function draftFrom(cfg: GlobalIndicatorConfig): Draft {
  return {
    params: { ...cfg.params },
    style: { ...(cfg.style as Record<string, string | number>) },
  };
}

// ---------------------------------------------------------------------------

/** Formulario inline de parametros de UN indicador (Aplicar / Restaurar). */
function IndicatorSettings({ cfg, onClose }: { cfg: GlobalIndicatorConfig; onClose: () => void }) {
  const updateIndicatorConfig = useLayoutStore((s) => s.updateIndicatorConfig);
  const resetIndicator = useLayoutStore((s) => s.resetIndicator);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(cfg));

  const error = validateIndicatorParams(cfg.type, draft.params);

  const setField = (f: FieldDef, raw: string | number | boolean) => {
    const [group, key] = f.path.split(".") as ["params" | "style", string];
    setDraft((d) => ({ ...d, [group]: { ...d[group], [key]: raw } }));
  };

  const getField = (f: FieldDef): string | number | boolean => {
    const [group, key] = f.path.split(".") as ["params" | "style", string];
    return draft[group][key] ?? "";
  };

  const apply = () => {
    if (error) return;
    updateIndicatorConfig(cfg.id, { params: draft.params, style: draft.style });
    onClose();
  };

  return (
    <div className="mt-1 rounded border border-edge bg-panel-2 p-2">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {FIELDS[cfg.type].map((f) => (
          <label key={f.path} className="flex items-center justify-between gap-2 text-[11px] text-muted">
            <span>{f.label}</span>
            {f.kind === "source" ? (
              <select
                value={String(getField(f) || "close")}
                onChange={(e) => setField(f, e.target.value)}
                className="rounded border border-edge bg-panel px-1 py-0.5 text-[11px] text-gray-200"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : f.kind === "color" ? (
              <input
                type="color"
                value={String(getField(f) || "#888888")}
                onChange={(e) => setField(f, e.target.value)}
                className="h-5 w-8 cursor-pointer border-0 bg-transparent p-0"
              />
            ) : f.kind === "bool" ? (
              <input
                type="checkbox"
                checked={Boolean(getField(f))}
                onChange={(e) => setField(f, e.target.checked)}
              />
            ) : (
              <input
                type="number"
                value={Number(getField(f))}
                min={f.min}
                max={f.max}
                step={f.step ?? 1}
                onChange={(e) =>
                  setField(f, f.kind === "int" ? parseInt(e.target.value || "0", 10) : Number(e.target.value))
                }
                className="w-16 rounded border border-edge bg-panel px-1 py-0.5 text-right text-[11px] text-gray-200"
              />
            )}
          </label>
        ))}
      </div>

      {error && <div className="mt-1.5 text-[10px] text-down">{error}</div>}

      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          onClick={() => {
            resetIndicator(cfg.id);
            onClose();
          }}
          className="rounded px-2 py-0.5 text-[11px] text-muted hover:bg-panel-3"
        >
          Restaurar
        </button>
        <button
          onClick={apply}
          disabled={!!error}
          className="rounded bg-accent px-2 py-0.5 text-[11px] text-white disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

/**
 * Boton "Indicadores" + popover global. Cada fila: toggle de visibilidad,
 * nombre y un engrane que abre el formulario de parametros. Todo persiste y se
 * aplica a las seis graficas (cada una calcula con sus propias velas).
 */
export function IndicatorToolbar() {
  const indicators = useLayoutStore((s) => s.globalIndicators);
  const toggle = useLayoutStore((s) => s.toggleIndicator);
  const [open, setOpen] = useState(false);
  const [settingsFor, setSettingsFor] = useState<string | null>(null);

  const activeCount = indicators.filter((i) => i.visible).length;

  return (
    <div className="flex items-center gap-2 border-b border-edge bg-panel px-3 py-1.5">
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-full border border-edge bg-panel-3 px-3 py-1 text-[11px] text-gray-100 hover:bg-edge"
        >
          ƒ Indicadores
          <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">{activeCount}</span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <div className="absolute left-0 z-30 mt-1 w-72 rounded-md border border-edge bg-panel-2 p-1.5 shadow-lg">
              {indicators.map((ind) => (
                <div key={ind.id} className="rounded px-1 py-0.5 hover:bg-panel-3/50">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggle(ind.id)}
                      title={ind.visible ? "Ocultar" : "Mostrar"}
                      className={`h-3.5 w-7 rounded-full transition-colors ${
                        ind.visible ? "bg-accent" : "bg-edge"
                      }`}
                    >
                      <span
                        className={`block h-3 w-3 rounded-full bg-white transition-transform ${
                          ind.visible ? "translate-x-3.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className={`flex-1 text-[11px] ${ind.visible ? "text-gray-100" : "text-muted"}`}>
                      {ind.name}
                    </span>
                    <button
                      onClick={() => setSettingsFor((s) => (s === ind.id ? null : ind.id))}
                      title="Parámetros"
                      className="rounded px-1 text-[12px] text-muted hover:text-gray-100"
                    >
                      ⚙
                    </button>
                  </div>
                  {settingsFor === ind.id && (
                    <IndicatorSettings cfg={ind} onClose={() => setSettingsFor(null)} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Resumen rapido de lo activo */}
      <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted">
        {indicators
          .filter((i) => i.visible)
          .map((i) => (
            <span key={i.id} className="rounded bg-panel-3 px-1.5 py-0.5" style={{ color: i.style.color }}>
              {i.name}
            </span>
          ))}
      </div>
    </div>
  );
}
