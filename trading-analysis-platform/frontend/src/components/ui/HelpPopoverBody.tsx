// Cuerpo del popover de ayuda "?" (compartido por Macro y Stock Scorecard).
// Muestra de forma legible: título, definición, cómo interpretarlo, lecturas
// positiva/neutral/negativa y por qué importa. Más ancho para no quedar apretado.

export interface DetailedHelp {
  title: string;
  definition: string;
  interpretation: string;
  positiveReading: string;
  neutralReading: string;
  negativeReading: string;
  whyItMatters: string;
  sourceNotes?: string;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="mt-2 block">
      <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="block text-[10px] leading-snug text-gray-300">{children}</span>
    </span>
  );
}

export function HelpPopoverBody({
  help,
  testid,
}: {
  help: DetailedHelp;
  testid: string;
}) {
  return (
    <span
      role="tooltip"
      data-testid={testid}
      className="absolute right-0 top-5 z-50 block max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] overflow-auto rounded-lg border border-edge bg-panel p-3 text-left shadow-xl"
    >
      <span className="block text-xs font-semibold text-gray-100">{help.title}</span>
      <span className="mt-1 block text-[10px] leading-snug text-gray-300">
        {help.definition}
      </span>

      <Section label="Cómo interpretarlo">{help.interpretation}</Section>

      <span className="mt-2 block text-[9px] font-semibold uppercase tracking-wide text-muted">
        Lecturas típicas
      </span>
      <span className="block text-[10px] leading-snug">
        <span className="font-semibold text-up">Positiva:</span>{" "}
        <span className="text-gray-300">{help.positiveReading}</span>
      </span>
      <span className="block text-[10px] leading-snug">
        <span className="font-semibold text-muted">Neutral:</span>{" "}
        <span className="text-gray-300">{help.neutralReading}</span>
      </span>
      <span className="block text-[10px] leading-snug">
        <span className="font-semibold text-down">Negativa:</span>{" "}
        <span className="text-gray-300">{help.negativeReading}</span>
      </span>

      <Section label="Por qué importa">{help.whyItMatters}</Section>

      {help.sourceNotes && (
        <span className="mt-2 block text-[9px] italic text-muted">{help.sourceNotes}</span>
      )}
    </span>
  );
}
