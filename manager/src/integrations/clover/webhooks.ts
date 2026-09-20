import { createHmac, timingSafeEqual } from "node:crypto";

import {
  CloverWebhookPayloadSchema,
  type CloverWebhookPayload,
} from "./schemas";

export const CLOVER_SIGNATURE_HEADER = "clover-signature";
export const CLOVER_PLATFORM_AUTH_HEADER = "x-clover-auth";

export type CloverWebhookVerificationFailure =
  | "empty_body"
  | "missing_secret"
  | "missing_signature"
  | "malformed_signature"
  | "timestamp_outside_tolerance"
  | "invalid_signature";

export type CloverWebhookVerificationResult =
  | {
      readonly ok: true;
      readonly timestampSeconds: number;
    }
  | {
      readonly ok: false;
      readonly reason: CloverWebhookVerificationFailure;
    };

export type CloverVerifiedWebhookResult =
  | {
      readonly ok: true;
      readonly timestampSeconds: number;
      readonly payload: CloverWebhookPayload;
    }
  | {
      readonly ok: false;
      readonly reason:
        | CloverWebhookVerificationFailure
        | "invalid_json"
        | "invalid_payload";
    };

export interface VerifyCloverWebhookInput {
  readonly rawBody: string | Uint8Array;
  readonly signatureHeader: string | null | undefined;
  readonly signingSecret: string | null | undefined;
  readonly toleranceSeconds?: number;
  readonly nowMs?: number;
}

interface ParsedSignatureHeader {
  readonly timestamp: number;
  readonly signatures: readonly string[];
}

function parseSignatureHeader(
  signatureHeader: string,
): ParsedSignatureHeader | null {
  let timestamp: number | undefined;
  const signatures: string[] = [];

  for (const rawPart of signatureHeader.split(",")) {
    const separatorIndex = rawPart.indexOf("=");
    if (separatorIndex < 1) {
      return null;
    }

    const key = rawPart.slice(0, separatorIndex).trim();
    const value = rawPart.slice(separatorIndex + 1).trim();

    if (key === "t") {
      if (timestamp !== undefined || !/^\d+$/.test(value)) {
        return null;
      }

      const parsedTimestamp = Number(value);
      if (!Number.isSafeInteger(parsedTimestamp) || parsedTimestamp < 0) {
        return null;
      }
      timestamp = parsedTimestamp;
    } else if (key === "v1") {
      if (!/^[a-fA-F0-9]{64}$/.test(value)) {
        return null;
      }
      signatures.push(value.toLowerCase());
    }
  }

  if (timestamp === undefined || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

function bodyBytes(rawBody: string | Uint8Array): Uint8Array {
  return typeof rawBody === "string"
    ? new TextEncoder().encode(rawBody)
    : rawBody;
}

function signaturesMatch(expectedHex: string, candidates: readonly string[]) {
  const expected = Buffer.from(expectedHex, "hex");

  return candidates.some((candidate) => {
    const supplied = Buffer.from(candidate, "hex");
    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  });
}

/**
 * Verifies Clover Hosted Checkout's timestamped HMAC over the exact raw body.
 * Any absent, malformed, stale, or mismatched input is rejected.
 */
export function verifyCloverWebhookSignature(
  input: VerifyCloverWebhookInput,
): CloverWebhookVerificationResult {
  const bytes = bodyBytes(input.rawBody);
  if (bytes.byteLength === 0) {
    return { ok: false, reason: "empty_body" };
  }

  if (!input.signingSecret || input.signingSecret.trim().length === 0) {
    return { ok: false, reason: "missing_secret" };
  }

  if (!input.signatureHeader) {
    return { ok: false, reason: "missing_signature" };
  }
  if (input.signatureHeader.length > 8_192) {
    return { ok: false, reason: "malformed_signature" };
  }

  const parsedHeader = parseSignatureHeader(input.signatureHeader);
  if (!parsedHeader) {
    return { ok: false, reason: "malformed_signature" };
  }

  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (
    !Number.isSafeInteger(toleranceSeconds) ||
    toleranceSeconds < 0 ||
    toleranceSeconds > 86_400
  ) {
    return { ok: false, reason: "timestamp_outside_tolerance" };
  }

  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    return { ok: false, reason: "timestamp_outside_tolerance" };
  }
  const ageSeconds = Math.abs(nowMs / 1_000 - parsedHeader.timestamp);
  if (ageSeconds > toleranceSeconds) {
    return { ok: false, reason: "timestamp_outside_tolerance" };
  }

  try {
    const digest = createHmac("sha256", input.signingSecret)
      .update(String(parsedHeader.timestamp), "utf8")
      .update(".", "utf8")
      .update(bytes)
      .digest("hex");

    if (!signaturesMatch(digest, parsedHeader.signatures)) {
      return { ok: false, reason: "invalid_signature" };
    }
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true, timestampSeconds: parsedHeader.timestamp };
}

/**
 * Verifies first and only then parses JSON and validates the Clover payload.
 */
export function verifyAndParseCloverWebhook(
  input: VerifyCloverWebhookInput,
): CloverVerifiedWebhookResult {
  const verification = verifyCloverWebhookSignature(input);
  if (!verification.ok) {
    return verification;
  }

  let untrustedPayload: unknown;
  try {
    const rawJson =
      typeof input.rawBody === "string"
        ? input.rawBody
        : new TextDecoder("utf-8", { fatal: true }).decode(input.rawBody);
    untrustedPayload = JSON.parse(rawJson) as unknown;
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const parsedPayload = CloverWebhookPayloadSchema.safeParse(untrustedPayload);
  if (!parsedPayload.success) {
    return { ok: false, reason: "invalid_payload" };
  }

  return {
    ok: true,
    timestampSeconds: verification.timestampSeconds,
    payload: parsedPayload.data,
  };
}

/**
 * Platform notifications use Clover's static X-Clover-Auth code rather than
 * the Hosted Checkout HMAC. Missing values always fail verification.
 */
export function verifyCloverPlatformAuthCode(
  providedAuthCode: string | null | undefined,
  expectedAuthCode: string | null | undefined,
): boolean {
  if (!providedAuthCode || !expectedAuthCode) {
    return false;
  }

  const provided = Buffer.from(providedAuthCode, "utf8");
  const expected = Buffer.from(expectedAuthCode, "utf8");

  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
