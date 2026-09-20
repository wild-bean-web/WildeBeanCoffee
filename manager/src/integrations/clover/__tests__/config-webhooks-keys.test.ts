import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  CloverConfigError,
  parseCloverBrandConfig,
  parseCloverManagerConfig,
} from "../config";
import {
  buildCloverExternalKey,
  buildCloverObjectVersionKey,
  buildCloverWebhookIdempotencyKey,
  parseCloverObjectId,
} from "../keys";
import {
  CloverHostedCheckoutNotificationSchema,
  CloverWebhookNotificationSchema,
} from "../schemas";
import {
  verifyAndParseCloverWebhook,
  verifyCloverPlatformAuthCode,
  verifyCloverWebhookSignature,
} from "../webhooks";
import {
  fixtureMerchantId,
  fixtureSigningSecret,
  hostedCheckoutWebhookFixture,
  platformWebhookFixture,
} from "./fixtures/clover";

const validEnvironment = {
  CLOVER_MANAGER_ENVIRONMENT: "sandbox",
  CLOVER_MANAGER_API_TOKEN: "manager-api-token-123456",
  CLOVER_MANAGER_MERCHANT_ID: fixtureMerchantId,
  CLOVER_MANAGER_WEBHOOK_SECRET: fixtureSigningSecret,
  CLOVER_MANAGER_READ_SCOPES: "ORDERS_R, PAYMENTS_R",
} as const;

function signatureFor(
  rawBody: string,
  timestampSeconds: number,
  secret = fixtureSigningSecret,
): string {
  const signature = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest("hex");
  return `t=${timestampSeconds},v1=${signature}`;
}

describe("manager Clover configuration", () => {
  it("derives a safe endpoint and validates declared read scopes", () => {
    const config = parseCloverManagerConfig(validEnvironment);

    expect(config.apiBaseUrl).toBe("https://apisandbox.dev.clover.com");
    expect(config.readScopes).toEqual(["ORDERS_R", "PAYMENTS_R"]);
    expect(config.pageSize).toBe(200);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.readScopes)).toBe(true);
  });

  it("parses brand settings without a merchant or API token", () => {
    const brand = parseCloverBrandConfig({
      CLOVER_MANAGER_ENVIRONMENT: "sandbox",
      CLOVER_MANAGER_PLATFORM_WEBHOOK_AUTH_CODE: "platform-auth-code-123456",
    });

    expect(brand.apiBaseUrl).toBe("https://apisandbox.dev.clover.com");
    expect(brand.readScopes).toEqual(["ORDERS_R", "PAYMENTS_R"]);
    expect(brand.platformWebhookAuthCode).toBe("platform-auth-code-123456");
    expect(brand.webhookSigningSecret).toBeUndefined();
  });

  it("rejects write scopes and missing required scopes", () => {
    expect(() =>
      parseCloverManagerConfig({
        ...validEnvironment,
        CLOVER_MANAGER_READ_SCOPES: "ORDERS_R,ORDERS_W",
      }),
    ).toThrow(CloverConfigError);

    expect(() =>
      parseCloverManagerConfig({
        ...validEnvironment,
        CLOVER_MANAGER_READ_SCOPES: "ORDERS_R",
      }),
    ).toThrow(/PAYMENTS_R/);
  });

  it("rejects reused storefront credentials", () => {
    expect(() =>
      parseCloverManagerConfig({
        ...validEnvironment,
        CLOVER_API_KEY: validEnvironment.CLOVER_MANAGER_API_TOKEN,
      }),
    ).toThrow(/must not reuse/);
  });
});

describe("Clover webhook verification", () => {
  it("verifies the exact raw body and parses a valid payload", () => {
    const rawBody = JSON.stringify(hostedCheckoutWebhookFixture);
    const timestampSeconds = 1_795_100_000;
    const result = verifyAndParseCloverWebhook({
      rawBody,
      signatureHeader: signatureFor(rawBody, timestampSeconds),
      signingSecret: fixtureSigningSecret,
      nowMs: timestampSeconds * 1_000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toMatchObject({
        id: "PAYMENT123",
        status: "APPROVED",
      });
    }
  });

  it("fails closed for missing, stale, malformed, and mismatched signatures", () => {
    const rawBody = JSON.stringify(hostedCheckoutWebhookFixture);
    const timestampSeconds = 1_795_100_000;
    const signed = signatureFor(rawBody, timestampSeconds);

    expect(
      verifyCloverWebhookSignature({
        rawBody,
        signatureHeader: undefined,
        signingSecret: fixtureSigningSecret,
        nowMs: timestampSeconds * 1_000,
      }),
    ).toEqual({ ok: false, reason: "missing_signature" });

    expect(
      verifyCloverWebhookSignature({
        rawBody,
        signatureHeader: signed,
        signingSecret: fixtureSigningSecret,
        nowMs: (timestampSeconds + 301) * 1_000,
      }),
    ).toEqual({ ok: false, reason: "timestamp_outside_tolerance" });

    expect(
      verifyCloverWebhookSignature({
        rawBody,
        signatureHeader: `t=${timestampSeconds},v1=not-hex`,
        signingSecret: fixtureSigningSecret,
        nowMs: timestampSeconds * 1_000,
      }),
    ).toEqual({ ok: false, reason: "malformed_signature" });

    expect(
      verifyCloverWebhookSignature({
        rawBody: `${rawBody} `,
        signatureHeader: signed,
        signingSecret: fixtureSigningSecret,
        nowMs: timestampSeconds * 1_000,
      }),
    ).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("validates platform auth codes with fail-closed semantics", () => {
    expect(verifyCloverPlatformAuthCode("auth-code-123", "auth-code-123")).toBe(
      true,
    );
    expect(verifyCloverPlatformAuthCode("wrong", "auth-code-123")).toBe(false);
    expect(verifyCloverPlatformAuthCode(undefined, "auth-code-123")).toBe(false);
  });

  it("validates merchant-keyed platform notifications", () => {
    expect(
      CloverWebhookNotificationSchema.parse(platformWebhookFixture),
    ).toMatchObject({ appId: "APP123" });
    expect(() =>
      CloverWebhookNotificationSchema.parse({
        ...platformWebhookFixture,
        merchants: {
          [fixtureMerchantId]: [
            {
              objectId: "O:ORDER123",
              type: "UPSERT",
              ts: 1,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("accepts Hosted Checkout's top-level checkout session shape", () => {
    expect(
      CloverHostedCheckoutNotificationSchema.parse({
        type: "PAYMENT",
        status: "APPROVED",
        id: "PAYMENT123",
        merchantId: fixtureMerchantId,
        checkoutSessionId: "CHECKOUT123",
      }),
    ).toMatchObject({ checkoutSessionId: "CHECKOUT123" });
  });
});

describe("Clover external and idempotency keys", () => {
  it("builds deterministic object and version keys", () => {
    expect(
      buildCloverExternalKey("order", fixtureMerchantId, "ORDER:123"),
    ).toBe("clover:v1:order:MERCHANT123:ORDER%3A123");
    expect(
      buildCloverObjectVersionKey(
        "payment",
        fixtureMerchantId,
        "PAYMENT123",
        1_795_100_000_000,
      ),
    ).toBe(
      "clover:v1:payment:MERCHANT123:PAYMENT123:version:1795100000000",
    );
  });

  it("builds a distinct key for each webhook object version", () => {
    const firstUpdate = platformWebhookFixture.merchants[fixtureMerchantId][0];
    const firstKey = buildCloverWebhookIdempotencyKey(
      fixtureMerchantId,
      firstUpdate,
    );
    const replayKey = buildCloverWebhookIdempotencyKey(
      fixtureMerchantId,
      firstUpdate,
    );
    const nextKey = buildCloverWebhookIdempotencyKey(fixtureMerchantId, {
      ...firstUpdate,
      ts: firstUpdate.ts + 1,
    });

    expect(firstKey).toBe(replayKey);
    expect(nextKey).not.toBe(firstKey);
    expect(parseCloverObjectId(firstUpdate.objectId)).toEqual({
      eventPrefix: "O",
      externalId: "ORDER123",
    });
  });
});
