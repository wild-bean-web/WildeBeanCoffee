import { createHash } from "node:crypto";

import { z } from "zod";

export const Sha256HexSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Expected a lowercase SHA-256 hex digest");

export type CanonicalKeyPart = string | number | boolean | null;

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function encodeCanonicalKeyParts(
  parts: readonly CanonicalKeyPart[],
): string {
  return JSON.stringify(
    parts.map((part) => {
      if (part === null) {
        return ["null", ""];
      }

      switch (typeof part) {
        case "string":
          return ["string", part.normalize("NFKC")];
        case "number":
          if (!Number.isSafeInteger(part)) {
            throw new TypeError("Canonical numeric key parts must be safe integers");
          }
          return ["integer", part.toString(10)];
        case "boolean":
          return ["boolean", part ? "true" : "false"];
      }
    }),
  );
}

export function hashCanonicalKeyParts(
  domain: string,
  parts: readonly CanonicalKeyPart[],
): string {
  const normalizedDomain = domain.normalize("NFKC").trim();
  if (normalizedDomain.length === 0) {
    throw new TypeError("Hash domain must not be empty");
  }

  return sha256Hex(
    encodeCanonicalKeyParts(["wild-bean-coffee", normalizedDomain, ...parts]),
  );
}
