import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseOneTimePurchasesCsv,
  summarizeHistoricalPurchases,
} from "../src/imports/one-time-purchases-csv";

async function main(): Promise<void> {
  const sourcePath = process.argv[2];
  const outputPath = process.argv[3];
  if (!sourcePath) {
    throw new Error(
      "Usage: tsx scripts/preview-historical-purchases.ts <purchases.csv> [output.json]",
    );
  }

  const source = await readFile(path.resolve(sourcePath), "utf8");
  const candidates = parseOneTimePurchasesCsv(source);
  const preview = {
    sourceFilename: path.basename(sourcePath),
    generatedAt: new Date().toISOString(),
    summary: summarizeHistoricalPurchases(candidates),
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
    error instanceof Error ? error.message : "Purchase preview failed.",
  );
  process.exitCode = 1;
});
