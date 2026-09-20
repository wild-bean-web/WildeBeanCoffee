import { describe, expect, it } from "vitest";
import { encryptSecret } from "@/lib/credentials";
import {
  CLOVER_ENV_TOKEN_REFERENCE,
  cloverClientConfigForConnection,
  cloverConnectionConfigured,
  cloverTokenSource,
} from "./connection-config";

describe("Clover connection credentials", () => {
  const env = {
    DATABASE_URL: "postgres://manager:manager@127.0.0.1:5433/manager",
    CLOVER_MANAGER_ENVIRONMENT: "sandbox",
    CLOVER_MANAGER_API_TOKEN: "env-bootstrap-token-123456",
  };

  it("uses an encrypted store token when one is stored", () => {
    process.env.DATABASE_URL = env.DATABASE_URL;
    const packed = encryptSecret("stored-cafe-token-987654");
    const connection = {
      id: "conn-1",
      locationId: "loc-1",
      externalAccountId: "MERCHANT_ROCKVILLE",
      credentialReference: "encrypted:v1",
      settings: { apiTokenEnc: packed, tokenLast4: "7654" },
    };

    expect(cloverTokenSource(connection, env.CLOVER_MANAGER_API_TOKEN)).toBe(
      "stored",
    );
    expect(cloverConnectionConfigured(connection, env.CLOVER_MANAGER_API_TOKEN)).toBe(
      true,
    );
    expect(cloverClientConfigForConnection(connection, env).apiToken).toBe(
      "stored-cafe-token-987654",
    );
    expect(cloverClientConfigForConnection(connection, env).merchantId).toBe(
      "MERCHANT_ROCKVILLE",
    );
  });

  it("falls back to the brand env token until the store token is saved", () => {
    const connection = {
      id: "conn-1",
      locationId: "loc-1",
      externalAccountId: "MERCHANT_ROCKVILLE",
      credentialReference: CLOVER_ENV_TOKEN_REFERENCE,
      settings: {},
    };

    expect(cloverTokenSource(connection, env.CLOVER_MANAGER_API_TOKEN)).toBe(
      "env",
    );
    expect(cloverClientConfigForConnection(connection, env).apiToken).toBe(
      "env-bootstrap-token-123456",
    );
  });
});
