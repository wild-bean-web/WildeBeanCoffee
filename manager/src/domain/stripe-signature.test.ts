import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { stripeSignatureMatches } from "./stripe-signature";

describe("stripe signatures", () => {
  it("accepts a fresh signature and rejects a stale one", () => {
    const payload = "{\"id\":\"evt_1\"}";
    const secret = "whsec_test";
    const nowMs = Date.parse("2026-09-26T12:00:00.000Z");
    const timestamp = Math.floor(nowMs / 1000);
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    const header = `t=${timestamp},v1=${signature}`;
    expect(stripeSignatureMatches(payload, header, secret, nowMs)).toBe(true);
    expect(stripeSignatureMatches(payload, header, secret, nowMs + 600_000)).toBe(false);
  });
});
