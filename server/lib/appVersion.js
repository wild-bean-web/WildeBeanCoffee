import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function loadVersion() {
  try {
    const data = JSON.parse(
      readFileSync(join(repoRoot, "version.json"), "utf8"),
    );
    if (data?.version) return data.version;
  } catch {
    // Fall back when version.json is unavailable (e.g. isolated test runs).
  }
  return "0.0.0";
}

export const APP_VERSION = loadVersion();
