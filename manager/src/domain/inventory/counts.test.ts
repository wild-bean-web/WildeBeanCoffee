import { describe, expect, it } from "vitest";

import {
  createBlindCountSession,
  createRecountSession,
  evaluateBlindCount,
  submitBlindCount,
} from "./counts";
import { createUnitDefinition } from "./uom";

const each = createUnitDefinition({
  code: "each",
  name: "each",
  symbol: "ea",
  dimension: "count",
  toBaseFactor: "1",
  definitionVersion: 1,
  quantityScale: 0,
});

function openSession() {
  return createBlindCountSession({
    sessionId: "count-1",
    assignedCounterId: "counter-1",
    createdAt: "2026-09-17T10:00:00.000Z",
    lines: [
      {
        lineId: "line-1",
        itemId: "coffee",
        locationId: "store",
        displayName: "Coffee bags",
        countingUnit: each,
      },
      {
        lineId: "line-2",
        itemId: "filters",
        locationId: "store",
        displayName: "Filters",
        countingUnit: each,
      },
    ],
  });
}

function submittedSession() {
  return submitBlindCount(openSession(), {
    submittedAt: "2026-09-17T10:30:00.000Z",
    entries: [
      { lineId: "line-2", countedQuantity: "1" },
      { lineId: "line-1", countedQuantity: "8" },
    ],
  });
}

const baseline = {
  sessionId: "count-1",
  capturedAt: "2026-09-17T09:59:59.000Z",
  lines: [
    { lineId: "line-1", expectedQuantity: "10", unitCostCents: "250" },
    { lineId: "line-2", expectedQuantity: "0", unitCostCents: "50" },
  ],
} as const;

describe("blind count sessions", () => {
  it("creates a frozen counter-facing sheet without expected balances", () => {
    const session = openSession();

    expect(session.status).toBe("open");
    expect(session.lines[0]).not.toHaveProperty("expectedQuantity");
    expect(session).not.toHaveProperty("entries");
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.lines)).toBe(true);
  });

  it("strictly rejects expected quantities accidentally sent to the counter", () => {
    expect(() =>
      createBlindCountSession({
        sessionId: "leaky",
        assignedCounterId: "counter",
        createdAt: "2026-09-17T10:00:00.000Z",
        lines: [
          {
            lineId: "line",
            itemId: "item",
            locationId: "store",
            displayName: "Item",
            countingUnit: each,
            expectedQuantity: "100",
          },
        ],
      } as never),
    ).toThrow();
  });

  it("requires every line exactly once and normalizes submission order", () => {
    const submitted = submittedSession();

    expect(submitted.entries?.map((entry) => entry.lineId)).toEqual([
      "line-1",
      "line-2",
    ]);
    expect(submitted.entries?.map((entry) => entry.countedQuantity)).toEqual([
      "8",
      "1",
    ]);

    expect(() =>
      submitBlindCount(openSession(), {
        submittedAt: "2026-09-17T10:30:00.000Z",
        entries: [{ lineId: "line-1", countedQuantity: "8" }],
      }),
    ).toThrow(/Missing count.*line-2/);
  });

  it("rejects duplicate submissions, negative counts, and baseline leakage", () => {
    const submitted = submittedSession();
    expect(() =>
      submitBlindCount(submitted, {
        submittedAt: "2026-09-17T11:00:00.000Z",
        entries: [
          { lineId: "line-1", countedQuantity: "8" },
          { lineId: "line-2", countedQuantity: "1" },
        ],
      }),
    ).toThrow(/only be submitted once/);

    expect(() =>
      submitBlindCount(openSession(), {
        submittedAt: "2026-09-17T10:30:00.000Z",
        entries: [
          { lineId: "line-1", countedQuantity: "-1" },
          { lineId: "line-2", countedQuantity: "1" },
        ],
      }),
    ).toThrow(/non-negative/);

    expect(() =>
      submitBlindCount(openSession(), {
        submittedAt: "2026-09-17T10:30:00.000Z",
        entries: [
          {
            lineId: "line-1",
            countedQuantity: "8",
            expectedQuantity: "10",
          },
          { lineId: "line-2", countedQuantity: "1" },
        ],
      } as never),
    ).toThrow();
  });
});

describe("variance and recount decisions", () => {
  it("explains every threshold that requires a recount", () => {
    const evaluation = evaluateBlindCount(submittedSession(), baseline, {
      absoluteQuantityThreshold: "1",
      varianceRatioThreshold: "0.1",
      valueThresholdCents: 300,
      recountUnexpectedStock: true,
    });

    expect(evaluation.recountRequired).toBe(true);
    expect(evaluation.recountLineIds).toEqual(["line-1", "line-2"]);
    expect(evaluation.lines[0]).toMatchObject({
      expectedQuantity: "10",
      countedQuantity: "8",
      varianceQuantity: "-2",
      varianceRatio: "0.2",
      estimatedValueVarianceCents: -500,
      recount: {
        required: true,
        reasons: [
          "absolute_quantity",
          "variance_ratio",
          "inventory_value",
        ],
      },
    });
    expect(evaluation.lines[1]).toMatchObject({
      varianceRatio: null,
      recount: {
        required: true,
        reasons: ["unexpected_stock"],
      },
    });
  });

  it("uses exceeds semantics so equality stays within tolerance", () => {
    const session = submitBlindCount(openSession(), {
      submittedAt: "2026-09-17T10:30:00.000Z",
      entries: [
        { lineId: "line-1", countedQuantity: "9" },
        { lineId: "line-2", countedQuantity: "0" },
      ],
    });
    const result = evaluateBlindCount(
      session,
      {
        ...baseline,
        lines: [
          {
            lineId: "line-1",
            expectedQuantity: "10",
            unitCostCents: "100",
          },
          {
            lineId: "line-2",
            expectedQuantity: "0",
            unitCostCents: "50",
          },
        ],
      },
      {
        absoluteQuantityThreshold: "1",
        varianceRatioThreshold: "0.1",
        valueThresholdCents: 100,
        recountUnexpectedStock: true,
      },
    );

    expect(result.recountRequired).toBe(false);
    expect(result.lines[0]?.recount.reasons).toEqual([]);
  });

  it("requires a complete, pre-count baseline for the same session", () => {
    expect(() =>
      evaluateBlindCount(
        submittedSession(),
        { ...baseline, sessionId: "another-session" },
        { absoluteQuantityThreshold: "1" },
      ),
    ).toThrow(/different session/);

    expect(() =>
      evaluateBlindCount(
        submittedSession(),
        { ...baseline, capturedAt: "2026-09-17T10:01:00.000Z" },
        { absoluteQuantityThreshold: "1" },
      ),
    ).toThrow(/captured before/);
  });

  it("creates a fresh blind recount containing only flagged lines", () => {
    const original = submittedSession();
    const evaluation = evaluateBlindCount(original, baseline, {
      absoluteQuantityThreshold: "100",
      recountUnexpectedStock: true,
    });
    const recount = createRecountSession(original, evaluation, {
      sessionId: "count-2",
      assignedCounterId: "counter-2",
      createdAt: "2026-09-17T11:00:00.000Z",
    });

    expect(recount).toMatchObject({
      sessionId: "count-2",
      parentSessionId: "count-1",
      round: 2,
      status: "open",
    });
    expect(recount.lines.map((line) => line.lineId)).toEqual(["line-2"]);
    expect(recount).not.toHaveProperty("entries");
    expect(recount.lines[0]).not.toHaveProperty("expectedQuantity");
    expect(recount.lines[0]).not.toHaveProperty("countedQuantity");
  });
});
