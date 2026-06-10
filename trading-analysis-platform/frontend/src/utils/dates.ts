// Utilidades de fechas. La conversion ms <-> segundos de Lightweight Charts vive
// en features/drawings/timeConversion.ts (fuente unica). Aqui se re-exporta para
// compatibilidad de imports existentes.

export { msToChartTime, chartTimeToMs } from "@/features/drawings/timeConversion";

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDateLabel(ms: number, intraday: boolean): string {
  const d = new Date(ms);
  if (intraday) {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
