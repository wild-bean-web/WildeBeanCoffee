import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, secretLast4 } from "./credentials";

describe("credential encryption", () => {
  it("round-trips a Clover API token", () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL?.trim() ||
      "postgres://manager:manager@127.0.0.1:5433/manager";
    const packed = encryptSecret("manager-api-token-123456");
    expect(packed.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(packed)).toBe("manager-api-token-123456");
    expect(secretLast4("manager-api-token-123456")).toBe("3456");
  });
});
