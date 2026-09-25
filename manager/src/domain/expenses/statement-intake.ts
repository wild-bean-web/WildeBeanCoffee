import { redactLongNumbers, statementDateToIso, type ExpenseGroup } from "./ledger";

export interface ParsedStatementLine {
  isoDate: string;
  description: string;
  signedCents: number;
  group: ExpenseGroup;
  category: string;
  fingerprint: string;
}

export type StatementIntakeDecision =
  | { status: "rejected_duplicate_file"; message: string }
  | { status: "rejected_not_a_statement"; message: string }
  | { status: "rejected_already_recorded"; message: string }
  | {
      status: "accepted";
      message: string;
      added: ParsedStatementLine[];
      skipped: number;
      startsOn: string;
      endsOn: string;
    };

const amountPattern =
  /(?<![A-Za-z0-9])(\(?-?\$?\d{1,3}(?:,\d{3})*\.\d{2}\)?)(?![A-Za-z0-9])/;

export function statementFingerprint(
  isoDate: string,
  signedCents: number,
  description: string,
): string {
  const normalized = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
  return `${isoDate}|${signedCents}|${normalized}`;
}

export function categorizeBankLine(description: string): {
  group: ExpenseGroup;
  category: string;
} {
  const text = description.toUpperCase();
  if (/ATM|CASH WITHDRAW|COUNTER WITHDRAW/.test(text)) {
    return { group: "cash", category: "ATM/counter withdrawals" };
  }
  if (/PAYROLL|ADP |PAYCHEX|GUSTO|INTUIT PAYROLL/.test(text)) {
    return { group: "operating", category: "Payroll" };
  }
  if (/RENT|YSI\*|YARDI|LANDLORD/.test(text)) {
    return { group: "operating", category: "Rent" };
  }
  if (/BGE|PEPCO|VERIZON|COMCAST|UTILITY|WASHINGTON GAS|WATER BILL/.test(text)) {
    return { group: "operating", category: "Utilities" };
  }
  if (/DOORDASH|UBER EATS|GRUBHUB/.test(text)) {
    return { group: "operating", category: "Delivery commissions" };
  }
  if (/INSURANCE|HARTFORD|PROGRESSIVE|GEICO/.test(text)) {
    return { group: "operating", category: "Insurance" };
  }
  if (/SYSCO|US FOODS|RESTAURANT DEPOT|COSTCO|SAMS CLUB|WEIS|GIANT|WEGMANS/.test(text)) {
    return { group: "operating", category: "Food and supplies" };
  }
  if (/\bCHECK\b|CHEQUE/.test(text)) {
    return { group: "unassigned", category: "Checks, payee not on statement" };
  }
  return { group: "unknown", category: "Unknown card purchases" };
}

function isDeposit(description: string): boolean {
  return /DEPOSIT|CLOVER|SQUARE|PAYOUT|TRANSFER FROM|ACH CREDIT|INTEREST PAID|REFUND FROM/.test(
    description.toUpperCase(),
  );
}

function isBalanceLine(description: string): boolean {
  return /BALANCE|BEGINNING|ENDING|TOTAL|STATEMENT PERIOD|PAGE \d/.test(
    description.toUpperCase(),
  );
}

function amountToSignedCents(raw: string): number | null {
  const credit = raw.includes("(") || raw.trim().startsWith("-");
  const digits = raw.replace(/[(),$\s-]/g, "").replace(/,/g, "");
  if (!/^\d+\.\d{2}$/.test(digits)) return null;
  const cents = Math.round(Number(digits) * 100);
  if (!Number.isSafeInteger(cents) || cents === 0) return null;
  return credit ? cents : -cents;
}

function defaultYear(text: string): number {
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  return years.length > 0 ? Math.max(...years) : new Date().getUTCFullYear();
}

export function parseBankStatementText(text: string): ParsedStatementLine[] {
  const year = defaultYear(text);
  const lines: ParsedStatementLine[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const dateMatch = rawLine.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
    const amountMatch = rawLine.match(amountPattern);
    if (!dateMatch || !amountMatch || amountMatch.index === undefined) continue;

    const dateText = dateMatch[1].includes("/", 3)
      ? dateMatch[1]
      : `${dateMatch[1]}/${year}`;
    const isoDate = statementDateToIso(
      dateText
        .split("/")
        .map((part, index) => (index === 2 && part.length === 2 ? `20${part}` : part.padStart(2, "0")))
        .join("/"),
    );
    if (!isoDate) continue;

    const description = redactLongNumbers(
      rawLine
        .replace(dateMatch[0], " ")
        .replace(amountMatch[0], " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    if (description.length < 3 || isBalanceLine(description) || isDeposit(description)) {
      continue;
    }

    const signedCents = amountToSignedCents(amountMatch[0]);
    if (signedCents === null || signedCents > 0) continue;

    const classified = categorizeBankLine(description);
    const fingerprint = statementFingerprint(isoDate, signedCents, description);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    lines.push({
      isoDate,
      description,
      signedCents,
      group: classified.group,
      category: classified.category,
      fingerprint,
    });
  }

  return lines;
}

export function decideStatementIntake(input: {
  fileAlreadyStored: boolean;
  parsed: ParsedStatementLine[];
  existingFingerprints: ReadonlySet<string>;
}): StatementIntakeDecision {
  if (input.fileAlreadyStored) {
    return {
      status: "rejected_duplicate_file",
      message: "This exact statement file is already in the books.",
    };
  }
  if (input.parsed.length < 3) {
    return {
      status: "rejected_not_a_statement",
      message:
        "This PDF does not contain enough bank transactions to add. Nothing was saved.",
    };
  }
  const added = input.parsed.filter(
    (line) => !input.existingFingerprints.has(line.fingerprint),
  );
  if (added.length === 0) {
    return {
      status: "rejected_already_recorded",
      message: "Every transaction in this statement is already recorded.",
    };
  }
  const dates = added.map((line) => line.isoDate).sort();
  const skipped = input.parsed.length - added.length;
  return {
    status: "accepted",
    message:
      skipped > 0
        ? `Added ${added.length} transactions. Skipped ${skipped} that were already recorded.`
        : `Added ${added.length} transactions from this statement.`,
    added,
    skipped,
    startsOn: dates[0] ?? added[0].isoDate,
    endsOn: dates.at(-1) ?? added[0].isoDate,
  };
}
