import { describe, expect, it, vi } from "vitest";

import {
  CloverApiError,
  CloverFetchReadClient,
  CloverResponseError,
  CloverTimeoutError,
} from "../client";

function orderFixture(id: string) {
  return {
    id,
    currency: "USD",
    total: 500,
    createdTime: Date.parse("2026-09-17T12:00:00.000Z"),
  };
}

function paymentFixture(id: string) {
  return {
    id,
    amount: 500,
    createdTime: Date.parse("2026-09-17T12:00:00.000Z"),
    result: "SUCCESS",
  };
}

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const item of items) {
    collected.push(item);
  }
  return collected;
}

const baseConfig = {
  apiBaseUrl: "https://clover.test",
  apiToken: "manager-token-that-must-stay-private",
  merchantId: "MERCHANT123",
  requestTimeoutMs: 1_000,
  maxRetries: 0,
  pageSize: 2,
} as const;

describe("CloverFetchReadClient", () => {
  it("paginates read-only requests with limit and offset", async () => {
    const responses = [
      { elements: [orderFixture("ORDER1"), orderFixture("ORDER2")] },
      { elements: [orderFixture("ORDER3")] },
    ];
    const fetchImplementation = vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        void input;
        void init;
        return new Response(JSON.stringify(responses.shift()), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );
    const client = new CloverFetchReadClient(baseConfig, {
      fetch: fetchImplementation,
    });

    const orders = await collect(
      client.listOrders({
        expand: ["lineItems", "payments"],
        filter: "createdTime>=1790000000000,createdTime<1790086400000",
      }),
    );

    expect(orders.map((order) => order.id)).toEqual([
      "ORDER1",
      "ORDER2",
      "ORDER3",
    ]);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(String(fetchImplementation.mock.calls[0]?.[0]));
    const secondUrl = new URL(String(fetchImplementation.mock.calls[1]?.[0]));
    expect(firstUrl.pathname).toBe(
      "/v3/merchants/MERCHANT123/orders",
    );
    expect(firstUrl.searchParams.get("limit")).toBe("2");
    expect(firstUrl.searchParams.get("offset")).toBe("0");
    expect(firstUrl.searchParams.get("expand")).toBe("lineItems,payments");
    expect(firstUrl.searchParams.getAll("filter")).toEqual([
      "createdTime>=1790000000000",
      "createdTime<1790086400000",
    ]);
    expect(secondUrl.searchParams.get("offset")).toBe("2");

    const firstRequest = fetchImplementation.mock.calls[0]?.[1];
    expect(firstRequest?.method).toBe("GET");
    expect(firstRequest?.redirect).toBe("error");
    expect(firstRequest?.headers).toMatchObject({
      authorization: `Bearer ${baseConfig.apiToken}`,
    });
  });

  it("lists employees on the merchant employees path", async () => {
    const fetchImplementation = vi.fn(
      async (): Promise<Response> =>
        new Response(JSON.stringify({ elements: [{ id: "EMP1", name: "Kalie" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new CloverFetchReadClient(baseConfig, {
      fetch: fetchImplementation,
    });
    const employees = await collect(client.listEmployees({ maxPages: 1 }));
    expect(employees.map((employee) => employee.id)).toEqual(["EMP1"]);
    const employeeUrl = new URL(String(fetchImplementation.mock.calls[0]?.[0]));
    expect(employeeUrl.pathname).toBe("/v3/merchants/MERCHANT123/employees");
  });

  it("retries transient responses and honors Retry-After", async () => {
    const sleep = vi.fn(async () => undefined);
    const responses = [
      new Response("temporarily unavailable", {
        status: 503,
        headers: { "retry-after": "0.01" },
      }),
      new Response(
        JSON.stringify({ elements: [paymentFixture("PAYMENT1")] }),
        { status: 200 },
      ),
    ];
    const fetchImplementation = vi.fn(
      async (): Promise<Response> => responses.shift() as Response,
    );
    const client = new CloverFetchReadClient(
      {
        ...baseConfig,
        maxRetries: 2,
      },
      { fetch: fetchImplementation, sleep, random: () => 0.5 },
    );

    const payments = await collect(client.listPayments());

    expect(payments).toHaveLength(1);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10, undefined);
  });

  it("times out an unresponsive fetch and does not retry when disabled", async () => {
    vi.useFakeTimers();
    try {
      const fetchImplementation = vi.fn(
        async (
          _input: RequestInfo | URL,
          init?: RequestInit,
        ): Promise<Response> =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            );
          }),
      );
      const client = new CloverFetchReadClient(
        {
          ...baseConfig,
          requestTimeoutMs: 100,
        },
        { fetch: fetchImplementation },
      );

      const request = client.getOrder("ORDER1");
      const expectation = expect(request).rejects.toBeInstanceOf(
        CloverTimeoutError,
      );
      await vi.advanceTimersByTimeAsync(100);

      await expectation;
      expect(fetchImplementation).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns sanitized HTTP and validation errors", async () => {
    const sensitiveBody = "manager-token-that-must-stay-private";
    const unauthorizedClient = new CloverFetchReadClient(baseConfig, {
      fetch: async () =>
        new Response(JSON.stringify({ message: sensitiveBody }), {
          status: 401,
        }),
    });

    let unauthorizedError: unknown;
    try {
      await unauthorizedClient.getOrder("ORDER1");
    } catch (error) {
      unauthorizedError = error;
    }

    expect(unauthorizedError).toBeInstanceOf(CloverApiError);
    expect(String(unauthorizedError)).not.toContain(sensitiveBody);

    const malformedClient = new CloverFetchReadClient(baseConfig, {
      fetch: async () =>
        new Response(JSON.stringify({ id: "ORDER1", total: 500 }), {
          status: 200,
        }),
    });
    await expect(malformedClient.getOrder("ORDER1")).rejects.toBeInstanceOf(
      CloverResponseError,
    );
  });
});
