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
} from "../src/imports/inventory-csv";

const PARSER_VERSION = "legacy-inventory-v1";

async function main(): Promise<void> {
  const sourcePath = process.argv[2];
  if (!sourcePath) {
    throw new Error(
      "Usage: tsx scripts/stage-inventory-import.ts <inventory.csv>",
    );
  }

  const absolutePath = path.resolve(sourcePath);
  const bytes = await readFile(absolutePath);
  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  const candidates = parseInventoryCsv(bytes.toString("utf8"));
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
        sourceFilename: path.basename(absolutePath),
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
          issues: [
            ...candidate.issues,
            "requires_base_uom_and_pack_review",
          ],
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
