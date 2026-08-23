/**
 * Bump semver before each production release.
 *
 * Usage:
 *   node scripts/release.js          # patch (default)
 *   node scripts/release.js patch
 *   node scripts/release.js minor
 *   node scripts/release.js major
 */
const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");

const root = join(__dirname, "..");

function bumpSemver(version, type) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Invalid semver: ${version}`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function updatePackageVersion(relativePath, nextVersion) {
  const fullPath = join(root, relativePath);
  const pkg = JSON.parse(readFileSync(fullPath, "utf8"));
  pkg.version = nextVersion;
  writeJson(fullPath, pkg);
}

const type = process.argv[2] || "patch";
if (!["patch", "minor", "major"].includes(type)) {
  console.error("Usage: node scripts/release.js [patch|minor|major]");
  process.exit(1);
}

const versionPath = join(root, "version.json");
const { version: current } = JSON.parse(readFileSync(versionPath, "utf8"));
const next = bumpSemver(current, type);

writeJson(versionPath, { version: next });
updatePackageVersion("package.json", next);
updatePackageVersion("client/package.json", next);
updatePackageVersion("server/package.json", next);

console.log(`Version bumped: ${current} → ${next}`);
console.log("");
console.log("Next steps for production release:");
console.log(
  "  git add version.json package.json client/package.json server/package.json",
);
console.log(`  git commit -m "Release v${next}"`);
console.log(`  git tag v${next}`);
console.log(`  git push && git push origin v${next}`);
