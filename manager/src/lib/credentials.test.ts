import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, rewrapSecret, secretLast4 } from "./credentials";

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

  it("moves a database-locked token onto the stable key", () => {
    const previousKey = process.env.MANAGER_CREDENTIALS_KEY;
    const previousDatabase = process.env.DATABASE_URL;
    delete process.env.MANAGER_CREDENTIALS_KEY;
    process.env.DATABASE_URL = "postgres://manager:old@127.0.0.1:5432/manager";
    const packed = encryptSecret("stored-with-database-url");
    process.env.MANAGER_CREDENTIALS_KEY = "stable-company-key";
    const opened = rewrapSecret(packed);
    expect(opened.plain).toBe("stored-with-database-url");
    expect(opened.changed).toBe(true);
    process.env.DATABASE_URL = "postgres://manager:new@127.0.0.1:6543/manager";
    expect(decryptSecret(opened.packed)).toBe("stored-with-database-url");
    if (previousKey === undefined) delete process.env.MANAGER_CREDENTIALS_KEY;
    else process.env.MANAGER_CREDENTIALS_KEY = previousKey;
    if (previousDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabase;
  });
});
