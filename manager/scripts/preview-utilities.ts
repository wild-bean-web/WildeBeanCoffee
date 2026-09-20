import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseUtilitiesCsv } from "../src/imports/utilities-csv";

async function main(): Promise<void> {
  const sourcePath = process.argv[2];
  const outputPath = process.argv[3];
  if (!sourcePath) {
    throw new Error(
      "Usage: tsx scripts/preview-utilities.ts <utilities.csv> [output.json]",
    );
  }

  const source = await readFile(path.resolve(sourcePath), "utf8");
  const candidates = parseUtilitiesCsv(source);
  const issueCounts = new Map<string, number>();
  for (const candidate of candidates) {
    for (const issue of candidate.issues) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    }
  }
  const preview = {
    sourceFilename: path.basename(sourcePath),
    generatedAt: new Date().toISOString(),
    summary: {
      expenseCategories: candidates.length,
      annualTotalCents: candidates.reduce(
        (sum, candidate) => sum + candidate.annualTotalCents,
        0,
      ),
      issueCounts: Object.fromEntries([...issueCounts.entries()].sort()),
    },
    candidates,
  };

  if (outputPath) {
    await writeFile(
      path.resolve(outputPath),
      `${JSON.stringify(preview, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
  }

  console.info(JSON.stringify(preview.summary, null, 2));
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Utilities preview failed.",
  );
  process.exitCode = 1;
});
