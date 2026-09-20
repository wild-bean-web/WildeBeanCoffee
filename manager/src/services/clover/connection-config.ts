import {
  CloverConfigError,
  parseCloverBrandConfig,
  type CloverFetchClientConfig,
} from "@/integrations/clover";
import type { JsonObject } from "@/db/schema/shared";
import { decryptSecret } from "@/lib/credentials";

export const CLOVER_ENV_TOKEN_REFERENCE = "env:CLOVER_MANAGER_API_TOKEN";
export const CLOVER_STORED_TOKEN_REFERENCE = "encrypted:v1";

export interface CloverConnectionSecrets {
  readonly id: string;
  readonly locationId: string | null;
  readonly externalAccountId: string;
  readonly credentialReference: string | null;
  readonly settings: JsonObject;
}

function settingString(settings: JsonObject, key: string): string | undefined {
  const value = settings[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function cloverTokenLast4(settings: JsonObject): string | null {
  return settingString(settings, "tokenLast4") ?? null;
}

export function cloverTokenSource(
  connection: CloverConnectionSecrets,
  envToken = process.env.CLOVER_MANAGER_API_TOKEN,
): "stored" | "env" | "missing" {
  if (settingString(connection.settings, "apiTokenEnc")?.startsWith("enc:v1:")) {
    return "stored";
  }
  if (
    connection.credentialReference === CLOVER_ENV_TOKEN_REFERENCE &&
    envToken?.trim()
  ) {
    return "env";
  }
  return "missing";
}

export function cloverConnectionConfigured(
  connection: CloverConnectionSecrets | null | undefined,
  envToken = process.env.CLOVER_MANAGER_API_TOKEN,
): boolean {
  if (!connection?.externalAccountId.trim()) return false;
  return cloverTokenSource(connection, envToken) !== "missing";
}

export function resolveCloverApiToken(
  connection: CloverConnectionSecrets,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const encrypted = settingString(connection.settings, "apiTokenEnc");
  if (encrypted?.startsWith("enc:v1:")) {
    return decryptSecret(encrypted);
  }

  if (connection.credentialReference === CLOVER_ENV_TOKEN_REFERENCE) {
    const token = env.CLOVER_MANAGER_API_TOKEN?.trim();
    if (token) return token;
  }

  throw new CloverConfigError([
    "This store's Clover API token is not configured.",
  ]);
}

export function cloverClientConfigForConnection(
  connection: CloverConnectionSecrets,
  env: Readonly<Record<string, string | undefined>> = process.env,
): CloverFetchClientConfig {
  const brand = parseCloverBrandConfig(env);
  return {
    apiBaseUrl: brand.apiBaseUrl,
    apiToken: resolveCloverApiToken(connection, env),
    merchantId: connection.externalAccountId,
    requestTimeoutMs: brand.requestTimeoutMs,
    maxRetries: brand.maxRetries,
    pageSize: brand.pageSize,
  };
}
