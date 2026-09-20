import { describe, expect, it } from "vitest";

import { validateJournalBatch } from "./journal";

function validBatch() {
  return {
    batchId: "batch-1",
    currency: "USD",
    postingDate: "2026-09-17",
    description: "Daily postings",
    entries: [
      {
        entryId: "entry-1",
        sourceEventId: "invoice-1",
        occurredAt: "2026-09-17T12:00:00.000Z",
        memo: "Record supplier invoice",
        lines: [
          {
            lineId: "inventory",
            accountId: "inventory",
            debitCents: 10_000,
            creditCents: 0,
          },
          {
            lineId: "payable",
            accountId: "accounts-payable",
            debitCents: 0,
            creditCents: 10_000,
          },
        ],
      },
      {
        entryId: "entry-2",
        sourceEventId: "payment-1",
        occurredAt: "2026-09-17T13:00:00.000Z",
        memo: "Pay supplier",
        lines: [
          {
            lineId: "payable",
            accountId: "accounts-payable",
            debitCents: 2_500,
            creditCents: 0,
          },
          {
            lineId: "cash",
            accountId: "cash",
            debitCents: 0,
            creditCents: 2_500,
          },
        ],
      },
    ],
  };
}

describe("balanced journal batch validation", () => {
  it("accepts balanced entries and totals them in integer cents", () => {
    const batch = validateJournalBatch(validBatch());

    expect(batch.totalDebitCents).toBe(12_500);
    expect(batch.totalCreditCents).toBe(12_500);
    expect(Object.isFrozen(batch)).toBe(true);
    expect(Object.isFrozen(batch.entries)).toBe(true);
  });

  it("rejects entries that only balance when netted against another entry", () => {
    const input = validBatch();
    input.entries[0]!.lines[1]!.creditCents = 9_000;
    input.entries[1]!.lines[1]!.creditCents = 3_500;

    // Batch totals happen to agree, but each source event is individually bad.
    expect(() => validateJournalBatch(input)).toThrow(
      /Journal entry is unbalanced/,
    );
  });

  it("rejects fractional dollars masquerading as cents", () => {
    const input = validBatch();
    input.entries[0]!.lines[0]!.debitCents = 100.25;
    expect(() => validateJournalBatch(input)).toThrow();
  });

  it("rejects unsafe individual amounts and overflowing batch totals", () => {
    const unsafe = validBatch();
    unsafe.entries[0]!.lines[0]!.debitCents =
      Number.MAX_SAFE_INTEGER + 1;
    expect(() => validateJournalBatch(unsafe)).toThrow();

    const maximum = Number.MAX_SAFE_INTEGER;
    const overflow = validBatch();
    for (const entry of overflow.entries) {
      entry.lines[0]!.debitCents = maximum;
      entry.lines[0]!.creditCents = 0;
      entry.lines[1]!.debitCents = 0;
      entry.lines[1]!.creditCents = maximum;
    }
    expect(() => validateJournalBatch(overflow)).toThrow(
      /exceeds safe integer cents/,
    );
  });

  it("requires exactly one non-zero side on every line", () => {
    const bothSides = validBatch();
    bothSides.entries[0]!.lines[0]!.creditCents = 10_000;
    expect(() => validateJournalBatch(bothSides)).toThrow(
      /exactly one non-zero side/,
    );

    const neitherSide = validBatch();
    neitherSide.entries[0]!.lines[0]!.debitCents = 0;
    expect(() => validateJournalBatch(neitherSide)).toThrow(
      /exactly one non-zero side/,
    );
  });

  it("rejects duplicate IDs and invalid calendar dates", () => {
    const duplicateEntries = validBatch();
    duplicateEntries.entries[1]!.entryId =
      duplicateEntries.entries[0]!.entryId;
    expect(() => validateJournalBatch(duplicateEntries)).toThrow(
      /entry IDs must be unique/,
    );

    const invalidDate = validBatch();
    invalidDate.postingDate = "2026-02-30";
    expect(() => validateJournalBatch(invalidDate)).toThrow(
      /valid YYYY-MM-DD/,
    );
  });
});
