import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseInventoryCsv,
  summarizeInventoryCandidates,
} from "../src/imports/inventory-csv";

async function main(): Promise<void> {
  const sourcePath = process.argv[2];
  const outputPath = process.argv[3];

  if (!sourcePath) {
    throw new Error(
      "Usage: tsx scripts/preview-inventory-import.ts <inventory.csv> [output.json]",
    );
  }

  const csv = await readFile(path.resolve(sourcePath), "utf8");
  const candidates = parseInventoryCsv(csv);
  const preview = {
    sourceFilename: path.basename(sourcePath),
    generatedAt: new Date().toISOString(),
    summary: summarizeInventoryCandidates(candidates),
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
    error instanceof Error ? error.message : "Inventory preview failed.",
  );
  process.exitCode = 1;
});
