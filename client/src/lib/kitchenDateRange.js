/** Shared date helpers for kitchen "filter by date" UIs (local calendar, no UTC shift). */

export function toLocalDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Inclusive local-calendar range as UTC ISO strings for API queries.
 * Matches what the kitchen date pickers mean (browser local midnight…end of day).
 */
export function localDateRangeToUtcIsoBounds(startDateStr, endDateStr) {
  const start = parseLocalDate(startDateStr);
  start.setHours(0, 0, 0, 0);
  const end = parseLocalDate(endDateStr);
  end.setHours(23, 59, 59, 999);
  return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
}

export function getRangeForPreset(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const copy = (d) => new Date(d.getTime());

  switch (preset) {
    case "today":
      return { start: toLocalDateString(today), end: toLocalDateString(today) };
    case "yesterday": {
      const y = copy(today);
      y.setDate(y.getDate() - 1);
      return { start: toLocalDateString(y), end: toLocalDateString(y) };
    }
    case "lastWeek": {
      const end = copy(today);
      const start = copy(today);
      start.setDate(start.getDate() - 6);
      return { start: toLocalDateString(start), end: toLocalDateString(end) };
    }
    case "lastMonth": {
      const start = copy(today);
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      const end = copy(today);
      end.setDate(0);
      return { start: toLocalDateString(start), end: toLocalDateString(end) };
    }
    case "lastYear": {
      const start = copy(today);
      start.setFullYear(start.getFullYear() - 1);
      start.setMonth(0);
      start.setDate(1);
      const end = copy(today);
      end.setFullYear(end.getFullYear() - 1);
      end.setMonth(11);
      end.setDate(31);
      return { start: toLocalDateString(start), end: toLocalDateString(end) };
    }
    default:
      return null;
  }
}
