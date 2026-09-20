import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    MANAGER_APP_URL: z.string().url().default("http://localhost:3001"),
    MANAGER_TIMEZONE: z.string().min(1).default("America/New_York"),
    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(30).default(10),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    DOCUMENT_STORAGE_PROVIDER: z
      .enum(["supabase", "memory"])
      .default("supabase"),
    DOCUMENT_STORAGE_BUCKET: z.string().min(1).default("manager-documents"),
    DOCUMENT_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024)
      .default(15 * 1024 * 1024),
    POSTMARK_INBOUND_SECRET: z.string().min(16).optional(),
    MANAGER_INVOICE_EMAIL: z.string().email().optional(),
    MANAGER_INVOICE_MAILBOX_HASH: z.string().min(1).max(256).optional(),
    DOCUMENT_AI_PROVIDER: z.enum(["azure", "disabled"]).default("disabled"),
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: z.string().url().optional(),
    AZURE_DOCUMENT_INTELLIGENCE_KEY: z.string().min(1).optional(),
    CLOVER_MANAGER_ENVIRONMENT: z
      .enum(["sandbox", "production"])
      .default("sandbox"),
    CLOVER_MANAGER_API_TOKEN: z.string().min(1).optional(),
    CLOVER_MANAGER_MERCHANT_ID: z.string().min(1).optional(),
    CLOVER_MANAGER_WEBHOOK_SECRET: z.string().min(16).optional(),
    CLOVER_MANAGER_PLATFORM_WEBHOOK_AUTH_CODE: z.string().min(1).optional(),
    MANAGER_CREDENTIALS_KEY: z.string().min(1).optional(),
    STOREFRONT_OUTBOX_SECRET: z.string().min(32).optional(),
    MANAGER_CRON_SECRET: z.string().min(32).optional(),
    SENTRY_DSN: z.string().url().optional(),
    MANAGER_DEMO_MODE: booleanFromString,
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && env.MANAGER_DEMO_MODE) {
      context.addIssue({
        code: "custom",
        path: ["MANAGER_DEMO_MODE"],
        message: "MANAGER_DEMO_MODE must be false in production.",
      });
    }

    if (env.NODE_ENV === "production") {
      const required: (keyof ServerEnv)[] = [
        "DATABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
      ];
      for (const key of required) {
        if (!env[key]) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required in production.`,
          });
        }
      }
      if (env.DOCUMENT_STORAGE_PROVIDER === "memory") {
        context.addIssue({
          code: "custom",
          path: ["DOCUMENT_STORAGE_PROVIDER"],
          message: "Memory document storage is forbidden in production.",
        });
      }
      if (!env.MANAGER_APP_URL.startsWith("https://")) {
        context.addIssue({
          code: "custom",
          path: ["MANAGER_APP_URL"],
          message: "MANAGER_APP_URL must use HTTPS in production.",
        });
      }
    }

    if (
      env.DOCUMENT_AI_PROVIDER === "azure" &&
      (!env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ||
        !env.AZURE_DOCUMENT_INTELLIGENCE_KEY)
    ) {
      context.addIssue({
        code: "custom",
        path: ["DOCUMENT_AI_PROVIDER"],
        message:
          "Azure Document Intelligence requires an endpoint and an API key.",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedServerEnv: ServerEnv | undefined;

function withoutBlankEnvValues(
  env: NodeJS.ProcessEnv,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      key,
      typeof value === "string" && value.trim() === "" ? undefined : value,
    ]),
  );
}

export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = serverEnvSchema.parse(withoutBlankEnvValues(process.env));
  }

  return cachedServerEnv;
}

export function resetServerEnvForTests(): void {
  cachedServerEnv = undefined;
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;
