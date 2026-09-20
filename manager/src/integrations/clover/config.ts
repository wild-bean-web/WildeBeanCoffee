import { z } from "zod";

export const CLOVER_READ_SCOPES = [
  "MERCHANT_R",
  "ORDERS_R",
  "PAYMENTS_R",
  "INVENTORY_R",
  "CUSTOMERS_R",
  "EMPLOYEES_R",
] as const;

export const CloverReadScopeSchema = z.enum(CLOVER_READ_SCOPES);
export type CloverReadScope = z.infer<typeof CloverReadScopeSchema>;

const REQUIRED_INGESTION_SCOPES = ["ORDERS_R", "PAYMENTS_R"] as const satisfies
  readonly CloverReadScope[];

const CloverEnvironmentSchema = z.enum(["sandbox", "production"]);

const readScopesFromEnvSchema = z
  .string()
  .min(1, "Declare the read-only scopes granted to the manager token.")
  .transform((value) =>
    value
      .split(",")
      .map((scope) => scope.trim().toUpperCase())
      .filter(Boolean),
  )
  .pipe(z.array(CloverReadScopeSchema).min(1))
  .superRefine((scopes, context) => {
    if (new Set(scopes).size !== scopes.length) {
      context.addIssue({
        code: "custom",
        message: "Read-only scopes must not contain duplicates.",
      });
    }

    for (const requiredScope of REQUIRED_INGESTION_SCOPES) {
      if (!scopes.includes(requiredScope)) {
        context.addIssue({
          code: "custom",
          message: `Missing required read-only scope ${requiredScope}.`,
        });
      }
    }
  });

const cloverManagerEnvSchema = z
  .object({
    CLOVER_MANAGER_ENVIRONMENT: CloverEnvironmentSchema.default("sandbox"),
    CLOVER_MANAGER_API_TOKEN: z
      .string()
      .trim()
      .min(16, "Manager API token must be configured."),
    CLOVER_MANAGER_MERCHANT_ID: z
      .string()
      .trim()
      .min(3)
      .max(128)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Manager merchant ID contains unsupported characters.",
      ),
    CLOVER_MANAGER_WEBHOOK_SECRET: z
      .string()
      .trim()
      .min(16, "Manager webhook signing secret must be configured."),
    CLOVER_MANAGER_PLATFORM_WEBHOOK_AUTH_CODE: z
      .string()
      .trim()
      .min(16)
      .optional(),
    CLOVER_MANAGER_READ_SCOPES: readScopesFromEnvSchema,
    CLOVER_MANAGER_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(120_000)
      .default(10_000),
    CLOVER_MANAGER_MAX_RETRIES: z.coerce
      .number()
      .int()
      .min(0)
      .max(8)
      .default(3),
    CLOVER_MANAGER_PAGE_SIZE: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000)
      .default(200),
  })
  .superRefine((env, context) => {
    if (env.CLOVER_MANAGER_API_TOKEN === env.CLOVER_MANAGER_WEBHOOK_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["CLOVER_MANAGER_WEBHOOK_SECRET"],
        message: "API and webhook credentials must be distinct.",
      });
    }
  });

export type CloverEnvironment = z.infer<typeof CloverEnvironmentSchema>;

export interface CloverManagerConfig {
  readonly environment: CloverEnvironment;
  readonly apiBaseUrl: string;
  readonly apiToken: string;
  readonly merchantId: string;
  readonly webhookSigningSecret: string;
  readonly platformWebhookAuthCode?: string;
  readonly readScopes: readonly CloverReadScope[];
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
  readonly pageSize: number;
}

export class CloverConfigError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid manager Clover configuration: ${issues.join(" ")}`);
    this.name = "CloverConfigError";
    this.issues = Object.freeze([...issues]);
  }
}

const API_BASE_URLS: Readonly<Record<CloverEnvironment, string>> = {
  sandbox: "https://apisandbox.dev.clover.com",
  production: "https://api.clover.com",
};

type CloverEnvironmentVariables = Readonly<
  Record<string, string | undefined>
>;

function assertCredentialsAreManagerOnly(
  env: CloverEnvironmentVariables,
  apiToken: string,
  webhookSigningSecret: string,
): void {
  const issues: string[] = [];

  if (env.NEXT_PUBLIC_CLOVER_MANAGER_API_TOKEN) {
    issues.push("Manager API token must never use a NEXT_PUBLIC_ variable.");
  }

  if (env.CLOVER_API_KEY && env.CLOVER_API_KEY === apiToken) {
    issues.push(
      "CLOVER_MANAGER_API_TOKEN must not reuse the storefront Clover API key.",
    );
  }

  if (
    env.CLOVER_WEBHOOK_SECRET &&
    env.CLOVER_WEBHOOK_SECRET === webhookSigningSecret
  ) {
    issues.push(
      "CLOVER_MANAGER_WEBHOOK_SECRET must not reuse the storefront webhook secret.",
    );
  }

  if (issues.length > 0) {
    throw new CloverConfigError(issues);
  }
}

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalBrandSecretSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(16).optional(),
);

const cloverBrandEnvSchema = z.object({
  CLOVER_MANAGER_ENVIRONMENT: CloverEnvironmentSchema.default("sandbox"),
  CLOVER_MANAGER_WEBHOOK_SECRET: optionalBrandSecretSchema,
  CLOVER_MANAGER_PLATFORM_WEBHOOK_AUTH_CODE: optionalBrandSecretSchema,
  CLOVER_MANAGER_READ_SCOPES: z.preprocess(
    emptyToUndefined,
    readScopesFromEnvSchema.optional(),
  ),
  CLOVER_MANAGER_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(120_000)
    .default(10_000),
  CLOVER_MANAGER_MAX_RETRIES: z.coerce.number().int().min(0).max(8).default(3),
  CLOVER_MANAGER_PAGE_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(1_000)
    .default(200),
});

export type CloverBrandConfig = {
  readonly environment: CloverEnvironment;
  readonly apiBaseUrl: string;
  readonly webhookSigningSecret?: string;
  readonly platformWebhookAuthCode?: string;
  readonly readScopes: readonly CloverReadScope[];
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
  readonly pageSize: number;
};

export function parseCloverBrandConfig(
  env: CloverEnvironmentVariables = process.env,
): CloverBrandConfig {
  const parsed = cloverBrandEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new CloverConfigError(
      parsed.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    );
  }

  const readScopes = Object.freeze(
    parsed.data.CLOVER_MANAGER_READ_SCOPES ?? ["ORDERS_R", "PAYMENTS_R"],
  ) as readonly CloverReadScope[];

  return Object.freeze({
    environment: parsed.data.CLOVER_MANAGER_ENVIRONMENT,
    apiBaseUrl: API_BASE_URLS[parsed.data.CLOVER_MANAGER_ENVIRONMENT],
    webhookSigningSecret: parsed.data.CLOVER_MANAGER_WEBHOOK_SECRET,
    platformWebhookAuthCode:
      parsed.data.CLOVER_MANAGER_PLATFORM_WEBHOOK_AUTH_CODE,
    readScopes,
    requestTimeoutMs: parsed.data.CLOVER_MANAGER_REQUEST_TIMEOUT_MS,
    maxRetries: parsed.data.CLOVER_MANAGER_MAX_RETRIES,
    pageSize: parsed.data.CLOVER_MANAGER_PAGE_SIZE,
  });
}

/**
 * Parses only dedicated manager credentials. The declared scope list is
 * intentionally allowlisted to Clover read permissions and must include the
 * order/payment permissions needed by this ingestion package.
 */
export function parseCloverManagerConfig(
  env: CloverEnvironmentVariables = process.env,
): CloverManagerConfig {
  const parsed = cloverManagerEnvSchema.safeParse(env);

  if (!parsed.success) {
    throw new CloverConfigError(
      parsed.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    );
  }

  assertCredentialsAreManagerOnly(
    env,
    parsed.data.CLOVER_MANAGER_API_TOKEN,
    parsed.data.CLOVER_MANAGER_WEBHOOK_SECRET,
  );

  const readScopes = Object.freeze([
    ...parsed.data.CLOVER_MANAGER_READ_SCOPES,
  ]);

  return Object.freeze({
    environment: parsed.data.CLOVER_MANAGER_ENVIRONMENT,
    apiBaseUrl: API_BASE_URLS[parsed.data.CLOVER_MANAGER_ENVIRONMENT],
    apiToken: parsed.data.CLOVER_MANAGER_API_TOKEN,
    merchantId: parsed.data.CLOVER_MANAGER_MERCHANT_ID,
    webhookSigningSecret: parsed.data.CLOVER_MANAGER_WEBHOOK_SECRET,
    platformWebhookAuthCode:
      parsed.data.CLOVER_MANAGER_PLATFORM_WEBHOOK_AUTH_CODE,
    readScopes,
    requestTimeoutMs: parsed.data.CLOVER_MANAGER_REQUEST_TIMEOUT_MS,
    maxRetries: parsed.data.CLOVER_MANAGER_MAX_RETRIES,
    pageSize: parsed.data.CLOVER_MANAGER_PAGE_SIZE,
  });
}
