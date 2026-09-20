import { z } from "zod";

import { deepFreeze, type DeepReadonly } from "../inventory/uom";

export const IntegerCentsSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

export const JournalLineSchema = z
  .strictObject({
    lineId: z.string().trim().min(1).max(160),
    accountId: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(500).optional(),
    debitCents: IntegerCentsSchema,
    creditCents: IntegerCentsSchema,
  })
  .superRefine((line, context) => {
    const hasDebit = line.debitCents > 0;
    const hasCredit = line.creditCents > 0;
    if (hasDebit === hasCredit) {
      context.addIssue({
        code: "custom",
        message: "A journal line must contain exactly one non-zero side",
      });
    }
  });

export type JournalLine = DeepReadonly<
  z.output<typeof JournalLineSchema>
>;

function addSafeCents(total: number, amount: number): number {
  if (amount > Number.MAX_SAFE_INTEGER - total) {
    throw new RangeError("Journal total exceeds safe integer cents");
  }
  return total + amount;
}

function sumLines(
  lines: readonly z.output<typeof JournalLineSchema>[],
  side: "debitCents" | "creditCents",
): number {
  return lines.reduce(
    (total, line) => addSafeCents(total, line[side]),
    0,
  );
}

export const JournalEntrySchema = z
  .strictObject({
    entryId: z.string().trim().min(1).max(160),
    sourceEventId: z.string().trim().min(1).max(160),
    occurredAt: z.string().datetime({ offset: true }),
    memo: z.string().trim().min(1).max(500),
    lines: z.array(JournalLineSchema).min(2),
  })
  .superRefine((entry, context) => {
    const lineIds = new Set<string>();
    for (const [index, line] of entry.lines.entries()) {
      if (lineIds.has(line.lineId)) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "lineId"],
          message: "Journal line IDs must be unique within an entry",
        });
      }
      lineIds.add(line.lineId);
    }

    try {
      const debitCents = sumLines(entry.lines, "debitCents");
      const creditCents = sumLines(entry.lines, "creditCents");
      if (debitCents !== creditCents) {
        context.addIssue({
          code: "custom",
          path: ["lines"],
          message: `Journal entry is unbalanced: ${debitCents} debit cents and ${creditCents} credit cents`,
        });
      }
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message:
          error instanceof Error
            ? error.message
            : "Journal entry total is invalid",
      });
    }
  });

export type JournalEntry = DeepReadonly<
  z.output<typeof JournalEntrySchema>
>;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const JournalBatchSchema = z
  .strictObject({
    batchId: z.string().trim().min(1).max(160),
    currency: z.string().regex(/^[A-Z]{3}$/),
    postingDate: z
      .string()
      .refine(isCalendarDate, "Posting date must be a valid YYYY-MM-DD date"),
    description: z.string().trim().min(1).max(500),
    entries: z.array(JournalEntrySchema).min(1),
  })
  .superRefine((batch, context) => {
    const entryIds = new Set<string>();
    let totalDebits = 0;
    let totalCredits = 0;

    for (const [index, entry] of batch.entries.entries()) {
      if (entryIds.has(entry.entryId)) {
        context.addIssue({
          code: "custom",
          path: ["entries", index, "entryId"],
          message: "Journal entry IDs must be unique within a batch",
        });
      }
      entryIds.add(entry.entryId);

      try {
        totalDebits = addSafeCents(
          totalDebits,
          sumLines(entry.lines, "debitCents"),
        );
        totalCredits = addSafeCents(
          totalCredits,
          sumLines(entry.lines, "creditCents"),
        );
      } catch (error) {
        context.addIssue({
          code: "custom",
          path: ["entries", index, "lines"],
          message:
            error instanceof Error
              ? error.message
              : "Journal batch total is invalid",
        });
      }
    }

    if (totalDebits !== totalCredits) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Journal batch debits and credits must balance",
      });
    }
  });

export type JournalBatch = DeepReadonly<
  z.output<typeof JournalBatchSchema>
>;

export interface ValidatedJournalBatch extends JournalBatch {
  readonly totalDebitCents: number;
  readonly totalCreditCents: number;
}

/**
 * Performs boundary validation and returns immutable, pre-totaled batch data.
 * Every amount and every intermediate total is a safe integer number of cents.
 */
export function validateJournalBatch(
  input: z.input<typeof JournalBatchSchema>,
): DeepReadonly<ValidatedJournalBatch> {
  const batch = JournalBatchSchema.parse(input);
  const totalDebitCents = batch.entries.reduce(
    (batchTotal, entry) =>
      addSafeCents(batchTotal, sumLines(entry.lines, "debitCents")),
    0,
  );
  const totalCreditCents = batch.entries.reduce(
    (batchTotal, entry) =>
      addSafeCents(batchTotal, sumLines(entry.lines, "creditCents")),
    0,
  );

  if (totalDebitCents !== totalCreditCents) {
    // The schema already checks this; retain a defensive invariant at use time.
    throw new Error("Journal batch is not balanced");
  }

  return deepFreeze({
    ...batch,
    totalDebitCents,
    totalCreditCents,
  });
}
