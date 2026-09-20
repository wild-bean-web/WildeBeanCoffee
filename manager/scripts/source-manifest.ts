import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

interface ManifestEntry {
  sourcePath: string;
  filename: string;
  byteSize: number;
  modifiedAt: string;
  sha256: string;
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }

  return hash.digest("hex");
}

async function collectFiles(inputPath: string): Promise<string[]> {
  const details = await stat(inputPath);
  if (details.isFile()) return [inputPath];
  if (!details.isDirectory()) return [];

  const entries = await readdir(inputPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => collectFiles(path.join(inputPath, entry.name))),
  );
  return nested.flat();
}

function parseArguments(argv: string[]): {
  inputs: string[];
  outputPath: string;
} {
  const outputIndex = argv.indexOf("--output");
  const outputPath =
    outputIndex >= 0
      ? argv[outputIndex + 1]
      : path.resolve(".manager-data", "source-manifest.json");

  if (!outputPath) {
    throw new Error("--output requires a path.");
  }

  const inputs =
    outputIndex >= 0
      ? argv.filter(
          (_, index) => index !== outputIndex && index !== outputIndex + 1,
        )
      : argv;

  if (inputs.length === 0) {
    throw new Error(
      "Pass one or more source files/directories. Originals are read and hashed, never copied or changed.",
    );
  }

  return { inputs, outputPath: path.resolve(outputPath) };
}

async function main(): Promise<void> {
  const { inputs, outputPath } = parseArguments(process.argv.slice(2));
  const files = (
    await Promise.all(inputs.map((input) => collectFiles(path.resolve(input))))
  )
    .flat()
    .sort((left, right) => left.localeCompare(right));

  const entries: ManifestEntry[] = [];
  for (const filePath of files) {
    const details = await stat(filePath);
    entries.push({
      sourcePath: filePath,
      filename: path.basename(filePath),
      byteSize: details.size,
      modifiedAt: details.mtime.toISOString(),
      sha256: await hashFile(filePath),
    });
  }

  const manifest = {
    schemaVersion: 1,
    batchId: randomUUID(),
    generatedAt: new Date().toISOString(),
    originalsModified: false,
    fileCount: entries.length,
    entries,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });

  console.info(
    `Manifested ${entries.length} source files without modifying originals: ${outputPath}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Manifest failed.");
  process.exitCode = 1;
});
