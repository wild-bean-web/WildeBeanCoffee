import { foodSubtotalCentsFromItems } from "./tipValidation.js";

/** Clover user id on charges created by hosted checkout (website), not a register login. */
export const HOSTED_CHECKOUT_EMPLOYEE_ID = "DFLTEMPLOYEE";

const WINDOW_BEFORE_MS = 2 * 60 * 1000;
const WINDOW_AFTER_MS = 3 * 60 * 60 * 1000;

export function paymentCreatedTimeMs(createdTime) {
  const n = Number(createdTime);
  if (!Number.isFinite(n)) return NaN;
  if (n > 0 && n < 1e12) return Math.round(n * 1000);
  return Math.round(n);
}

/**
 * Clover's payment.amount for a website checkout is the pretax food subtotal.
 * Our draft amountCents includes tax and tip, so both have to count as a match.
 * @param {{ amountCents?: number, orderDraft?: { items?: Array<{ price?: number, quantity?: number }> }, items?: Array<{ price?: number, quantity?: number }> }} draft
 */
export function draftChargeTargetsCents(draft) {
  const items = draft?.orderDraft?.items || draft?.items || [];
  const food = foodSubtotalCentsFromItems(items);
  const stated = Math.round(Number(draft?.amountCents));
  const targets = new Set();
  if (food > 0) targets.add(food);
  if (Number.isFinite(stated) && stated > 0) targets.add(stated);
  return targets;
}

/**
 * Pick the single hosted-checkout payment that belongs to this draft.
 * Ignores in-store tickets (a named register employee) and charges outside
 * the few hours after the checkout was created.
 * @returns {{ ok: true, paymentId: string } | { ok: false, reason: string }}
 */
export function selectHostedCheckoutPayment(payments, draft, now = Date.now()) {
  const createdAt = new Date(draft?.createdAt || 0).getTime();
  const targets = draftChargeTargetsCents(draft);
  if (!Number.isFinite(createdAt) || createdAt <= 0 || targets.size === 0) {
    return { ok: false, reason: "bad_inputs" };
  }

  const start = createdAt - WINDOW_BEFORE_MS;
  const end = Math.min(now + 60 * 1000, createdAt + WINDOW_AFTER_MS);
  const matches = [];

  for (const payment of payments || []) {
    if (String(payment?.result || "").toUpperCase() !== "SUCCESS") continue;
    if (payment?.voided === true) continue;
    const employeeId =
      payment?.employee?.id ||
      (typeof payment?.employee === "string" ? payment.employee : "");
    if (employeeId && employeeId !== HOSTED_CHECKOUT_EMPLOYEE_ID) continue;
    const amount = Number(payment?.amount);
    if (!targets.has(amount)) continue;
    const createdMs = paymentCreatedTimeMs(payment?.createdTime);
    if (!Number.isFinite(createdMs) || createdMs < start || createdMs > end) continue;
    matches.push(payment);
  }

  if (matches.length === 0) return { ok: false, reason: "no_match" };
  if (matches.length > 1) return { ok: false, reason: "ambiguous" };
  const paymentId = String(matches[0].id || "").trim();
  if (!paymentId) return { ok: false, reason: "no_payment_id" };
  return { ok: true, paymentId };
}
