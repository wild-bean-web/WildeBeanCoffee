/**
 * Resolve kitchen dashboard date filters from query string.
 * Prefer rangeStart & rangeEnd (ISO 8601) from the browser so Mongo uses the same
 * instants as the kitchen PC’s local date pickers. Fallback: YYYY-MM-DD in server local
 * (legacy / curl).
 */
export function resolveKitchenDateRangeFromQuery(query) {
  const { rangeStart, rangeEnd, date, startDate, endDate, all } = query;

  if (all === "true") {
    return { useAll: true };
  }

  if (rangeStart && rangeEnd) {
    const rs = new Date(String(rangeStart));
    const re = new Date(String(rangeEnd));
    if (!Number.isNaN(rs.getTime()) && !Number.isNaN(re.getTime())) {
      return { useAll: false, rangeStart: rs, rangeEnd: re };
    }
  }

  let rs;
  let re;
  if (startDate && endDate) {
    rs = new Date(startDate);
    rs.setHours(0, 0, 0, 0);
    re = new Date(endDate);
    re.setHours(23, 59, 59, 999);
  } else if (date) {
    rs = new Date(date);
    rs.setHours(0, 0, 0, 0);
    re = new Date(date);
    re.setHours(23, 59, 59, 999);
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    rs = today;
    re = new Date();
    re.setHours(23, 59, 59, 999);
  }
  return { useAll: false, rangeStart: rs, rangeEnd: re };
}
