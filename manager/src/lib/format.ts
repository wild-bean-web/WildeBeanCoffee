export function formatMoney(
  cents: number,
  currency = "USD",
  locale = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function parseMoneyToCents(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const negative =
    /^\(.*\)$/.test(trimmed.replace(/\s/g, "")) ||
    /-\s*\$?\s*[\d,]/.test(trimmed) ||
    /\$\s*-/.test(trimmed);
  const numeric = trimmed.replace(/[()]/g, "").replace(/[^\d.]/g, "");
  if (!numeric) return null;
  const amount = Number.parseFloat(numeric);
  if (!Number.isFinite(amount)) return null;
  const cents = Math.round(amount * 100);
  return negative ? -Math.abs(cents) : cents;
}

export function formatPercent(
  ratio: number | null | undefined,
  digits = 1,
): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) {
    return "—";
  }
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatHours(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatShortDate(
  value: Date | string,
  timezone = "America/New_York",
): string {
  const date =
    value instanceof Date
      ? value
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00.000Z`)
        : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
