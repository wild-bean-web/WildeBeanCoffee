import { readFileSync } from "node:fs";
import postgres from "postgres";
import { z } from "zod";
import { redactLongNumbers, statementDateToIso } from "../src/domain/expenses/ledger";

const ledgerFileSchema = z.object({
  lines: z.array(
    z.object({
      date: z.string(),
      description: z.string(),
      group: z.string(),
      category: z.string(),
      signedCents: z.number(),
    }),
  ),
});

const files = [
  "mt-expense-ledger-2024-2025.json",
  "mt-expense-ledger-2026.json",
];

const organizationId = process.argv[2];
if (!organizationId) {
  throw new Error("Pass the organization id.");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sql = postgres(databaseUrl, { ssl: "require", max: 1, prepare: false });

const rows: Array<{
  businessDate: string;
  description: string;
  group: string;
  category: string;
  signedCents: number;
  sourceFile: string;
  sourceIndex: number;
}> = [];

for (const filename of files) {
  const parsed = ledgerFileSchema.parse(
    JSON.parse(readFileSync(`.manager-data/${filename}`, "utf8")),
  );
  parsed.lines.forEach((line, sourceIndex) => {
    const businessDate = statementDateToIso(line.date);
    if (!businessDate) return;
    rows.push({
      businessDate,
      description: redactLongNumbers(line.description).trim(),
      group: line.group,
      category: line.category.trim(),
      signedCents: line.signedCents,
      sourceFile: filename,
      sourceIndex,
    });
  });
}

await sql`
  insert into statement_expense_lines ${sql(
    rows.map((row) => ({
      organization_id: organizationId,
      business_date: row.businessDate,
      description: row.description,
      expense_group: row.group,
      category: row.category,
      signed_cents: row.signedCents,
      source_file: row.sourceFile,
      source_index: row.sourceIndex,
    })),
  )}
  on conflict (organization_id, source_file, source_index) do update set
    business_date = excluded.business_date,
    description = excluded.description,
    expense_group = excluded.expense_group,
    category = excluded.category,
    signed_cents = excluded.signed_cents,
    updated_at = now()
`;

const [{ count }] = await sql<{ count: number }[]>`
  select count(*)::int as count from statement_expense_lines where organization_id = ${organizationId}
`;
console.log(`statement_lines ${count}`);
await sql.end();
