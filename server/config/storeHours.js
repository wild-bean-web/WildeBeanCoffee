/**
 * Canonical store hours for seed, location sync, and fallbacks.
 * Opening times: Mon–Sat 7:00 AM, Sunday 8:00 AM. Close 6:00 PM every day.
 */
export const STORE_CLOSE_TIME = "18:00";

export const STORE_HOURS = [
  { day: "Monday", opens: "07:00", closes: STORE_CLOSE_TIME },
  { day: "Tuesday", opens: "07:00", closes: STORE_CLOSE_TIME },
  { day: "Wednesday", opens: "07:00", closes: STORE_CLOSE_TIME },
  { day: "Thursday", opens: "07:00", closes: STORE_CLOSE_TIME },
  { day: "Friday", opens: "07:00", closes: STORE_CLOSE_TIME },
  { day: "Saturday", opens: "07:00", closes: STORE_CLOSE_TIME },
  { day: "Sunday", opens: "08:00", closes: STORE_CLOSE_TIME },
];
