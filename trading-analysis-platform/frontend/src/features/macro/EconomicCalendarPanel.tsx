import { MacroInfoTooltip } from "./MacroInfoTooltip";
import type { EconomicCalendarEvent } from "./macroTypes";

const IMPACT_STYLE: Record<string, string> = {
  HIGH: "bg-red-500/15 text-down",
  MEDIUM: "bg-yellow-500/15 text-yellow-400",
  LOW: "bg-panel-3 text-muted",
};

/**
 * Calendario económico (próximos releases de FRED). Solo se monta cuando HAY
 * eventos (la página oculta el panel si no hay datos útiles, en vez de mostrar
 * una tarjeta grande vacía).
 */
export function EconomicCalendarPanel({
  events,
  source = "FRED",
}: {
  events: EconomicCalendarEvent[];
  source?: string;
}) {
  if (events.length === 0) return null;
  return (
    <section
      data-testid="economic-calendar-panel"
      className="rounded-lg border border-edge bg-panel p-4"
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h2 className="text-sm font-bold text-gray-100">Calendario económico</h2>
          <MacroInfoTooltip helpKey="economicCalendar" />
        </div>
        <span className="rounded bg-panel-3 px-1.5 py-0.5 text-[9px] uppercase text-muted">
          Fuente: {source}
        </span>
      </div>
      <p className="mb-2 text-[9px] italic text-muted">
        Las fechas de publicación de FRED provienen de los calendarios de cada
        fuente y pueden no coincidir con el momento exacto de disponibilidad del dato.
      </p>
      <ul className="space-y-1.5">
        {events.map((e, i) => (
          <li
            key={`${e.eventName}-${e.date}-${i}`}
            data-testid="calendar-event"
            className="flex items-center justify-between gap-2 rounded border border-edge bg-panel-2 p-2 text-xs"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-100">{e.eventName}</p>
              <p className="text-[10px] text-muted">
                {e.date ?? "—"}
                {e.time ? ` · ${e.time}` : ""}
                {e.country ? ` · ${e.country}` : ""}
              </p>
            </div>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                IMPACT_STYLE[e.impact] ?? "text-muted"
              }`}
            >
              {e.impact}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
