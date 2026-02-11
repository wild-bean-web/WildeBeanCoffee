/**
 * Parse inventory-export-v2.xlsx and output JSON for comparison with the website menu.
 * Run from repo root: node scripts/parse-inventory-xlsx.js
 * Requires: npm install xlsx (in repo root or server)
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const xlsxPath = join(repoRoot, "inventory-export-v2.xlsx");

let XLSX;
try {
  const pkg = await import("xlsx");
  XLSX = pkg.default;
} catch (e) {
  console.error("Missing 'xlsx' package. From repo root run: npm install xlsx");
  process.exit(1);
}

function run() {
  let workbook;
  try {
    workbook = XLSX.readFile(xlsxPath);
  } catch (e) {
    console.error("Could not read file:", xlsxPath, e.message);
    process.exit(1);
  }

  const out = { sheetNames: workbook.SheetNames, sheets: {} };

  workbook.SheetNames.forEach((name) => {
    const sheet = workbook.Sheets[name];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    out.sheets[name] = json;
    console.log(`\n=== Sheet: "${name}" (${json.length} rows) ===`);
    if (json.length > 0) {
      console.log("Columns:", Object.keys(json[0]).join(" | "));
      console.log("First 3 rows sample:");
      json.slice(0, 3).forEach((row, i) => console.log(JSON.stringify(row, null, 2)));
    }
  });

  const outPath = join(repoRoot, "inventory-export-v2-parsed.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log("\nFull JSON written to:", outPath);
}

run();
