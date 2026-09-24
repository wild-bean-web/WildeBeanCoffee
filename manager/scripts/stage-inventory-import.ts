import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { closeDatabase, getDb } from "../src/db/client";
import {
  importBatches,
  importRows,
  organizations,
} from "../src/db/schema";
import type { JsonObject } from "../src/db/schema/shared";
import {
  parseInventoryCsv,
  summarizeInventoryCandidates,
  type InventoryImportCandidate,
} from "../src/imports/inventory-csv";

const PARSER_VERSION = "legacy-inventory-v1";

interface SourceManifest {
  entries?: Array<{ filename?: string; sha256?: string }>;
}

async function shaFromManifest(
  filename: string,
): Promise<string | null> {
  try {
    const manifestPath = path.resolve(".manager-data/source-manifest.json");
    const manifest = JSON.parse(
      await readFile(manifestPath, "utf8"),
    ) as SourceManifest;
    const entry = manifest.entries?.find((item) => item.filename === filename);
    return entry?.sha256 && /^[0-9a-f]{64}$/.test(entry.sha256)
      ? entry.sha256
      : null;
  } catch {
    return null;
  }
}

async function loadInventorySource(absolutePath: string): Promise<{
  candidates: InventoryImportCandidate[];
  sourceFilename: string;
  sourceSha256: string;
}> {
  const bytes = await readFile(absolutePath);
  const fileSha256 = createHash("sha256").update(bytes).digest("hex");

  if (absolutePath.toLowerCase().endsWith(".json")) {
    const preview = JSON.parse(bytes.toString("utf8")) as {
      sourceFilename?: unknown;
      candidates?: unknown;
    };
    if (!Array.isArray(preview.candidates)) {
      throw new Error("Inventory preview JSON is missing candidates.");
    }
    const candidates = preview.candidates as InventoryImportCandidate[];
    const sourceFilename =
      typeof preview.sourceFilename === "string" && preview.sourceFilename.trim()
        ? path.basename(preview.sourceFilename)
        : path.basename(absolutePath);
    return {
      candidates,
      sourceFilename,
      sourceSha256: (await shaFromManifest(sourceFilename)) ?? fileSha256,
    };
  }

  return {
    candidates: parseInventoryCsv(bytes.toString("utf8")),
    sourceFilename: path.basename(absolutePath),
    sourceSha256: fileSha256,
  };
}

async function main(): Promise<void> {
  const sourcePath = process.argv[2];
  if (!sourcePath) {
    throw new Error(
      "Usage: tsx scripts/stage-inventory-import.ts <inventory.csv|inventory-preview.json>",
    );
  }

  const absolutePath = path.resolve(sourcePath);
  const { candidates, sourceFilename, sourceSha256 } =
    await loadInventorySource(absolutePath);
  const db = getDb();

  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, "wild-bean-coffee"))
    .limit(1);
  if (!organization) {
    throw new Error("Run npm run db:seed before staging inventory.");
  }

  const [existing] = await db
    .select({ id: importBatches.id })
    .from(importBatches)
    .where(
      and(
        eq(importBatches.organizationId, organization.id),
        eq(importBatches.importKind, "legacy_inventory"),
        eq(importBatches.sourceSha256, sourceSha256),
        eq(importBatches.parserVersion, PARSER_VERSION),
      ),
    )
    .limit(1);
  if (existing) {
    console.info(
      JSON.stringify({ batchId: existing.id, duplicate: true }, null, 2),
    );
    return;
  }

  const batchId = await db.transaction(async (transaction) => {
    const [batch] = await transaction
      .insert(importBatches)
      .values({
        organizationId: organization.id,
        importKind: "legacy_inventory",
        sourceFilename,
        sourceSha256,
        parserVersion: PARSER_VERSION,
        status: "staged",
        rowCount: candidates.length,
        readyCount: 0,
        reviewCount: candidates.length,
        metadata: summarizeInventoryCandidates(candidates),
      })
      .returning({ id: importBatches.id });

    if (candidates.length > 0) {
      await transaction.insert(importRows).values(
        candidates.map((candidate) => ({
          organizationId: organization.id,
          importBatchId: batch.id,
          sourceRowNumber: candidate.sourceRow,
          status: "needs_review" as const,
          rawData: candidate as unknown as JsonObject,
          normalizedData: {
            category: candidate.category,
            productName: candidate.productName,
            alias: candidate.alias,
            vendorName: candidate.vendorName,
            purchasePackLabel: candidate.purchasePackLabel,
            purchasePackQuantity: candidate.purchasePackQuantity,
            vendorPriceCents: candidate.vendorPriceCents,
            vendorUnitPriceCents: candidate.vendorUnitPriceCents,
            provenance: "imported",
          },
          issues: candidate.issues,
        })),
      );
    }
    return batch.id;
  });

  console.info(
    JSON.stringify(
      {
        batchId,
        stagedRows: candidates.length,
        postedRows: 0,
        sourceSha256,
        sourceFilename,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Inventory staging failed.",
    );
    process.exitCode = 1;
  })
  .finally(closeDatabase);
