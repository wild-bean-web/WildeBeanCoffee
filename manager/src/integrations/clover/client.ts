import { z } from "zod";

import type { CloverManagerConfig } from "./config";
import {
  CloverEmployeeSchema,
  CloverIdSchema,
  CloverOrderSchema,
  CloverPageSchema,
  CloverPaymentSchema,
  CloverRefundSchema,
  CloverShiftSchema,
  type CloverEmployee,
  type CloverOrder,
  type CloverPayment,
  type CloverRefund,
  type CloverShift,
} from "./schemas";

const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type Sleep = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

export interface CloverListOptions {
  readonly pageSize?: number;
  readonly startingOffset?: number;
  readonly maxPages?: number;
  readonly filter?: string;
  readonly expand?: readonly string[];
  readonly orderBy?: string;
  readonly signal?: AbortSignal;
}

export interface CloverGetOptions {
  readonly expand?: readonly string[];
  readonly signal?: AbortSignal;
}

export interface CloverReadClient {
  getOrder(orderId: string, options?: CloverGetOptions): Promise<CloverOrder>;
  listOrders(options?: CloverListOptions): AsyncIterable<CloverOrder>;
  getPayment(
    paymentId: string,
    options?: CloverGetOptions,
  ): Promise<CloverPayment>;
  listPayments(options?: CloverListOptions): AsyncIterable<CloverPayment>;
  getRefund(
    refundId: string,
    options?: CloverGetOptions,
  ): Promise<CloverRefund>;
  listRefunds(options?: CloverListOptions): AsyncIterable<CloverRefund>;
  listPaymentRefunds(
    paymentId: string,
    options?: CloverListOptions,
  ): AsyncIterable<CloverRefund>;
  listEmployees(options?: CloverListOptions): AsyncIterable<CloverEmployee>;
  listShifts(options?: CloverListOptions): AsyncIterable<CloverShift>;
}

export interface CloverFetchClientConfig {
  readonly apiBaseUrl: string;
  readonly apiToken: string;
  readonly merchantId: string;
  readonly requestTimeoutMs?: number;
  readonly maxRetries?: number;
  readonly pageSize?: number;
  readonly retryBaseDelayMs?: number;
  readonly maxRetryDelayMs?: number;
}

export interface CloverFetchClientDependencies {
  readonly fetch?: FetchLike;
  readonly sleep?: Sleep;
  readonly random?: () => number;
}

export class CloverApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly body: string | null;

  constructor(status: number, body?: string) {
    super(`Clover request failed with HTTP ${status}.`);
    this.name = "CloverApiError";
    this.status = status;
    this.retryable = RETRYABLE_HTTP_STATUSES.has(status);
    this.body = body?.trim() ? body.trim().slice(0, 1_000) : null;
  }
}

export class CloverNetworkError extends Error {
  constructor() {
    super("Clover request failed before a response was received.");
    this.name = "CloverNetworkError";
  }
}

export class CloverTimeoutError extends Error {
  constructor() {
    super("Clover request exceeded its configured timeout.");
    this.name = "CloverTimeoutError";
  }
}

export class CloverRequestAbortedError extends Error {
  constructor() {
    super("Clover request was aborted by the caller.");
    this.name = "CloverRequestAbortedError";
  }
}

export class CloverResponseError extends Error {
  constructor() {
    super("Clover returned an invalid response.");
    this.name = "CloverResponseError";
  }
}

export class CloverPaginationLimitError extends Error {
  constructor() {
    super("Clover pagination reached the configured page limit.");
    this.name = "CloverPaginationLimitError";
  }
}

const clientConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  apiToken: z.string().min(1),
  merchantId: CloverIdSchema,
  requestTimeoutMs: z.number().int().min(100).max(120_000).default(10_000),
  maxRetries: z.number().int().min(0).max(8).default(3),
  pageSize: z.number().int().min(1).max(1_000).default(200),
  retryBaseDelayMs: z.number().int().min(1).max(60_000).default(250),
  maxRetryDelayMs: z.number().int().min(1).max(120_000).default(10_000),
});

const listOptionsSchema = z.object({
  pageSize: z.number().int().min(1).max(1_000),
  startingOffset: z.number().int().nonnegative(),
  maxPages: z.number().int().positive().max(100_000),
  filter: z.string().min(1).max(8_000).optional(),
  expand: z
    .array(
      z
        .string()
        .trim()
        .regex(
          /^[A-Za-z][A-Za-z0-9.]*$/,
          "Clover expand fields contain unsupported characters.",
        ),
    )
    .max(50)
    .optional(),
  orderBy: z.string().min(1).max(1_000).optional(),
});

interface ParsedListOptions {
  readonly pageSize: number;
  readonly startingOffset: number;
  readonly maxPages: number;
  readonly filter?: string;
  readonly expand?: readonly string[];
  readonly orderBy?: string;
}

function defaultSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new CloverRequestAbortedError());
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const complete = () => {
      cleanup();
      resolve();
    };
    const abort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new CloverRequestAbortedError());
    };
    const timeout = setTimeout(complete, milliseconds);

    signal?.addEventListener("abort", abort, { once: true });
  });
}

function validateBaseUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "" && url.pathname !== "/")
  ) {
    throw new Error(
      "Clover API base URL must be an HTTPS origin without credentials, path, query, or fragment.",
    );
  }

  return url.origin;
}

function readRetryAfterMs(response: Response, nowMs: number): number | null {
  const rawValue = response.headers.get("retry-after");
  if (!rawValue) {
    return null;
  }

  const seconds = Number(rawValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1_000);
  }

  const dateMs = Date.parse(rawValue);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - nowMs) : null;
}

export class CloverFetchReadClient implements CloverReadClient {
  private readonly apiBaseUrl: string;
  private readonly apiToken: string;
  private readonly merchantId: string;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly defaultPageSize: number;
  private readonly retryBaseDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly fetchImplementation: FetchLike;
  private readonly sleep: Sleep;
  private readonly random: () => number;

  constructor(
    config: CloverFetchClientConfig,
    dependencies: CloverFetchClientDependencies = {},
  ) {
    const parsedConfig = clientConfigSchema.parse(config);

    this.apiBaseUrl = validateBaseUrl(parsedConfig.apiBaseUrl);
    this.apiToken = parsedConfig.apiToken;
    this.merchantId = parsedConfig.merchantId;
    this.requestTimeoutMs = parsedConfig.requestTimeoutMs;
    this.maxRetries = parsedConfig.maxRetries;
    this.defaultPageSize = parsedConfig.pageSize;
    this.retryBaseDelayMs = parsedConfig.retryBaseDelayMs;
    this.maxRetryDelayMs = parsedConfig.maxRetryDelayMs;
    this.fetchImplementation = dependencies.fetch ?? globalThis.fetch;
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.random = dependencies.random ?? Math.random;

    if (!this.fetchImplementation) {
      throw new Error("A Fetch API implementation is required.");
    }
  }

  getOrder(
    orderId: string,
    options: CloverGetOptions = {},
  ): Promise<CloverOrder> {
    return this.getResource(
      ["orders", CloverIdSchema.parse(orderId)],
      CloverOrderSchema,
      options,
    );
  }

  listOrders(options: CloverListOptions = {}): AsyncIterable<CloverOrder> {
    return this.listResource("orders", CloverOrderSchema, options);
  }

  getPayment(
    paymentId: string,
    options: CloverGetOptions = {},
  ): Promise<CloverPayment> {
    return this.getResource(
      ["payments", CloverIdSchema.parse(paymentId)],
      CloverPaymentSchema,
      options,
    );
  }

  listPayments(options: CloverListOptions = {}): AsyncIterable<CloverPayment> {
    return this.listResource("payments", CloverPaymentSchema, options);
  }

  getRefund(
    refundId: string,
    options: CloverGetOptions = {},
  ): Promise<CloverRefund> {
    return this.getResource(
      ["refunds", CloverIdSchema.parse(refundId)],
      CloverRefundSchema,
      options,
    );
  }

  listRefunds(options: CloverListOptions = {}): AsyncIterable<CloverRefund> {
    return this.listResource("refunds", CloverRefundSchema, options);
  }

  listPaymentRefunds(
    paymentId: string,
    options: CloverListOptions = {},
  ): AsyncIterable<CloverRefund> {
    return this.listResource(
      "refunds",
      CloverRefundSchema,
      options,
      ["payments", CloverIdSchema.parse(paymentId)],
    );
  }

  listEmployees(
    options: CloverListOptions = {},
  ): AsyncIterable<CloverEmployee> {
    return this.listResource("employees", CloverEmployeeSchema, options);
  }

  listShifts(options: CloverListOptions = {}): AsyncIterable<CloverShift> {
    return this.listResource("shifts", CloverShiftSchema, options);
  }

  private parseListOptions(options: CloverListOptions): ParsedListOptions {
    return listOptionsSchema.parse({
      pageSize: options.pageSize ?? this.defaultPageSize,
      startingOffset: options.startingOffset ?? 0,
      maxPages: options.maxPages ?? 10_000,
      filter: options.filter,
      expand: options.expand ? [...options.expand] : undefined,
      orderBy: options.orderBy,
    });
  }

  private buildSearchParameters(
    options: Pick<ParsedListOptions, "filter" | "expand" | "orderBy">,
  ): URLSearchParams {
    const search = new URLSearchParams();
    if (options.filter) {
      for (const clause of options.filter.split(",")) {
        const trimmed = clause.trim();
        if (trimmed) search.append("filter", trimmed);
      }
    }
    if (options.expand && options.expand.length > 0) {
      search.set("expand", options.expand.join(","));
    }
    if (options.orderBy) {
      search.set("orderBy", options.orderBy);
    }
    return search;
  }

  private async getResource<T>(
    resourcePath: readonly string[],
    schema: z.ZodType<T>,
    options: CloverGetOptions,
  ): Promise<T> {
    const parsedExpand = listOptionsSchema.shape.expand
      .optional()
      .parse(options.expand ? [...options.expand] : undefined);
    const search = new URLSearchParams();
    if (parsedExpand && parsedExpand.length > 0) {
      search.set("expand", parsedExpand.join(","));
    }

    return this.request(resourcePath, search, schema, options.signal);
  }

  private async *listResource<T>(
    resource: "orders" | "payments" | "refunds" | "employees" | "shifts",
    itemSchema: z.ZodType<T>,
    options: CloverListOptions,
    parentPath: readonly string[] = [],
  ): AsyncGenerator<T> {
    const parsedOptions = this.parseListOptions(options);
    let offset = parsedOptions.startingOffset;

    for (let pageNumber = 0; pageNumber < parsedOptions.maxPages; pageNumber++) {
      const search = this.buildSearchParameters(parsedOptions);
      search.set("limit", String(parsedOptions.pageSize));
      search.set("offset", String(offset));

      const page = await this.request(
        [...parentPath, resource],
        search,
        CloverPageSchema(itemSchema),
        options.signal,
      );

      for (const item of page.elements) {
        yield item;
      }

      if (page.elements.length < parsedOptions.pageSize) {
        return;
      }

      offset += page.elements.length;
    }

    throw new CloverPaginationLimitError();
  }

  private buildUrl(
    resourcePath: readonly string[],
    search: URLSearchParams,
  ): URL {
    const encodedPath = ["v3", "merchants", this.merchantId, ...resourcePath]
      .map(encodeURIComponent)
      .join("/");
    const url = new URL(`/${encodedPath}`, this.apiBaseUrl);
    url.search = search.toString();
    return url;
  }

  private retryDelayMs(attempt: number, response?: Response): number {
    const retryAfter = response
      ? readRetryAfterMs(response, Date.now())
      : null;
    if (retryAfter !== null) {
      return Math.min(retryAfter, this.maxRetryDelayMs);
    }

    const exponential = this.retryBaseDelayMs * 2 ** attempt;
    const jitterMultiplier = 0.8 + this.random() * 0.4;
    return Math.min(
      this.maxRetryDelayMs,
      Math.max(0, Math.round(exponential * jitterMultiplier)),
    );
  }

  private async waitBeforeRetry(
    attempt: number,
    signal: AbortSignal | undefined,
    response?: Response,
  ): Promise<void> {
    await this.sleep(this.retryDelayMs(attempt, response), signal);
    if (signal?.aborted) {
      throw new CloverRequestAbortedError();
    }
  }

  private async request<T>(
    resourcePath: readonly string[],
    search: URLSearchParams,
    schema: z.ZodType<T>,
    callerSignal?: AbortSignal,
  ): Promise<T> {
    if (callerSignal?.aborted) {
      throw new CloverRequestAbortedError();
    }

    const url = this.buildUrl(resourcePath, search);

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      let timedOut = false;
      const abortFromCaller = () => controller.abort();
      callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.requestTimeoutMs);

      let response: Response | undefined;
      let requestFailed = false;
      try {
        response = await this.fetchImplementation(url, {
          method: "GET",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${this.apiToken}`,
          },
          redirect: "error",
          cache: "no-store",
          signal: controller.signal,
        });
      } catch {
        if (callerSignal?.aborted) {
          throw new CloverRequestAbortedError();
        }
        requestFailed = true;
      } finally {
        clearTimeout(timeout);
        callerSignal?.removeEventListener("abort", abortFromCaller);
      }

      if (requestFailed || !response) {
        if (attempt < this.maxRetries) {
          await this.waitBeforeRetry(attempt, callerSignal);
          continue;
        }
        throw timedOut ? new CloverTimeoutError() : new CloverNetworkError();
      }

      if (!response.ok) {
        if (
          RETRYABLE_HTTP_STATUSES.has(response.status) &&
          attempt < this.maxRetries
        ) {
          await this.waitBeforeRetry(attempt, callerSignal, response);
          continue;
        }
        const errorBody = await response.text().catch(() => "");
        throw new CloverApiError(response.status, errorBody);
      }

      let untrustedResponse: unknown;
      try {
        untrustedResponse = (await response.json()) as unknown;
      } catch {
        throw new CloverResponseError();
      }

      const parsedResponse = schema.safeParse(untrustedResponse);
      if (!parsedResponse.success) {
        throw new CloverResponseError();
      }

      return parsedResponse.data;
    }

    throw new CloverNetworkError();
  }
}

export function createCloverReadClient(
  config: CloverManagerConfig,
  dependencies: CloverFetchClientDependencies = {},
): CloverReadClient {
  return new CloverFetchReadClient(
    {
      apiBaseUrl: config.apiBaseUrl,
      apiToken: config.apiToken,
      merchantId: config.merchantId,
      requestTimeoutMs: config.requestTimeoutMs,
      maxRetries: config.maxRetries,
      pageSize: config.pageSize,
    },
    dependencies,
  );
}
