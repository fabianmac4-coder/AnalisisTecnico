// Formateadores compartidos del módulo de portafolio.

export function money(value: number | null | undefined, currency = "USD"): string {
  if (value == null) return "n/d";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${currency && currency !== "USD" ? ` ${currency}` : ""}`;
}

export function pct(value: number | null | undefined): string {
  if (value == null) return "n/d";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function gainClass(value: number | null | undefined): string {
  if (value == null) return "text-muted";
  return value >= 0 ? "text-up" : "text-down";
}
