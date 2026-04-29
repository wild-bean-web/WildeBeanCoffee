const STORE_TIME_ZONE =
  process.env.NEXT_PUBLIC_STORE_TIMEZONE || "America/New_York";

/**
 * Format a date/time in the store timezone by default.
 * Pass date+time options through Intl.DateTimeFormat.
 */
export function formatStoreDateTime(input, options = {}) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    ...options,
  }).format(date);
}

export { STORE_TIME_ZONE };
