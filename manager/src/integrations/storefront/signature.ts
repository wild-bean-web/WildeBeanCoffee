import { createHmac, timingSafeEqual } from "node:crypto";

export const STOREFRONT_SIGNATURE_HEADER = "x-wild-bean-signature";

interface SignatureParts {
  timestamp: number;
  digest: string;
}

function parseSignature(value: string | null): SignatureParts | null {
  if (!value || value.length > 512) return null;
  const parts = Object.fromEntries(
    value.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  if (!/^\d+$/.test(parts.t ?? "")) return null;
  if (!/^[a-f0-9]{64}$/i.test(parts.v1 ?? "")) return null;
  return { timestamp: Number(parts.t), digest: parts.v1.toLowerCase() };
}

export function signStorefrontEvent(
  rawBody: string,
  secret: string,
  timestampSeconds = Math.floor(Date.now() / 1_000),
): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestampSeconds},v1=${digest}`;
}

export function verifyStorefrontEventSignature(input: {
  rawBody: string;
  signature: string | null;
  secret: string | undefined;
  nowMs?: number;
  toleranceSeconds?: number;
}): boolean {
  if (!input.rawBody || !input.secret) return false;
  const parsed = parseSignature(input.signature);
  if (!parsed) return false;

  const ageSeconds = Math.abs(
    (input.nowMs ?? Date.now()) / 1_000 - parsed.timestamp,
  );
  if (ageSeconds > (input.toleranceSeconds ?? 300)) return false;

  const expected = createHmac("sha256", input.secret)
    .update(`${parsed.timestamp}.${input.rawBody}`, "utf8")
    .digest();
  const supplied = Buffer.from(parsed.digest, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
