/**
 * Optional ops notifications when paid checkout does not become an order.
 * Slack incoming webhooks: POST JSON { "text": "..." }.
 */

const MAX = 3500;

/**
 * @param {string} message
 */
export async function notifyOrderOpsAlert(message) {
  const url = process.env.ORDER_OPS_ALERT_WEBHOOK_URL?.trim();
  if (!url) return;
  const text = `[Wild Bean Coffee] ${String(message).slice(0, MAX)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(
        "[ORDER_OPS_ALERT] Webhook non-OK:",
        res.status,
        await res.text().catch(() => ""),
      );
    }
  } catch (e) {
    console.error("[ORDER_OPS_ALERT] Request failed:", e?.message || e);
  }
}
