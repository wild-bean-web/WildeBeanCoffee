import { afterEach, describe, expect, it } from "vitest";
import { getServerEnv, resetServerEnvForTests } from "./env";

const managedKeys = [
  "NODE_ENV",
  "MANAGER_DEMO_MODE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT",
  "SENTRY_DSN",
] as const;

const originalValues = Object.fromEntries(
  managedKeys.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const key of managedKeys) {
    const original = originalValues[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
  resetServerEnvForTests();
});

describe("getServerEnv", () => {
  it("treats blank optional URLs as unset in demo mode", () => {
    process.env.NODE_ENV = "development";
    process.env.MANAGER_DEMO_MODE = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = "";
    process.env.SENTRY_DSN = "";
    resetServerEnvForTests();

    const env = getServerEnv();

    expect(env.MANAGER_DEMO_MODE).toBe(true);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
    expect(env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT).toBeUndefined();
    expect(env.SENTRY_DSN).toBeUndefined();
  });
});
