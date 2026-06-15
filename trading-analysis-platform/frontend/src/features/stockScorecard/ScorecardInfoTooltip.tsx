import { useState } from "react";
import { STOCK_SCORECARD_HELP } from "./stockScorecardHelp";
import { HelpPopoverBody } from "@/components/ui/HelpPopoverBody";

/**
 * Botón "?" con popover detallado que explica una sección/métrica del Stock
 * Scorecard (definición, cómo interpretarlo, lecturas positiva/neutral/negativa
 * y por qué importa). Escritorio: hover; móvil: click/tap. Si no hay ayuda para
 * la clave, no renderiza nada. Mismo patrón que MacroInfoTooltip.
 */
export function ScorecardInfoTooltip({ helpKey }: { helpKey?: string }) {
  const help = helpKey ? STOCK_SCORECARD_HELP[helpKey] : undefined;
  const [open, setOpen] = useState(false);
  if (!help) return null;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`Qué significa: ${help.title}`}
        data-testid={`scorecard-info-${helpKey}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-edge bg-panel-3 text-[9px] font-bold text-muted hover:border-accent hover:text-accent"
      >
        ?
      </button>
      {open && (
        <HelpPopoverBody help={help} testid={`scorecard-info-popover-${helpKey}`} />
      )}
    </span>
  );
}
