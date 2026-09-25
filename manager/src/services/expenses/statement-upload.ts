import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { statementExpenseLines, statementUploads } from "@/db/schema";
import {
  decideStatementIntake,
  parseBankStatementText,
  statementFingerprint,
  type StatementIntakeDecision,
} from "@/domain/expenses/statement-intake";
import { extractPdfPageTexts } from "@/services/documents/pdf-text";
import {
  digestSourceBytes,
  getDocumentStore,
} from "@/services/storage/document-store";

export interface StatementBasis {
  lineCount: number;
  latestDate: string | null;
  upload: {
    filename: string;
    createdAt: Date;
    status: string;
    addedCount: number;
    message: string;
    startsOn: string | null;
    endsOn: string | null;
  } | null;
}

export async function latestStatementBasis(
  organizationId: string,
): Promise<StatementBasis> {
  const db = getDb();
  const [stats] = await db
    .select({
      lineCount: sql<number>`count(*)::int`,
      latestDate: sql<string | null>`max(${statementExpenseLines.businessDate})`,
    })
    .from(statementExpenseLines)
    .where(eq(statementExpenseLines.organizationId, organizationId));

  const [upload] = await db
    .select({
      filename: statementUploads.filename,
      createdAt: statementUploads.createdAt,
      status: statementUploads.status,
      addedCount: statementUploads.addedCount,
      message: statementUploads.message,
      startsOn: statementUploads.startsOn,
      endsOn: statementUploads.endsOn,
    })
    .from(statementUploads)
    .where(eq(statementUploads.organizationId, organizationId))
    .orderBy(desc(statementUploads.createdAt))
    .limit(1);

  return {
    lineCount: stats?.lineCount ?? 0,
    latestDate: stats?.latestDate ?? null,
    upload: upload ?? null,
  };
}

async function existingFingerprints(organizationId: string): Promise<Set<string>> {
  const rows = await getDb()
    .select({
      businessDate: statementExpenseLines.businessDate,
      description: statementExpenseLines.description,
      signedCents: statementExpenseLines.signedCents,
      fingerprint: statementExpenseLines.fingerprint,
    })
    .from(statementExpenseLines)
    .where(eq(statementExpenseLines.organizationId, organizationId));

  return new Set(
    rows.map(
      (row) =>
        row.fingerprint ??
        statementFingerprint(row.businessDate, row.signedCents, row.description),
    ),
  );
}

export async function ingestBankStatement(input: {
  organizationId: string;
  filename: string;
  bytes: Uint8Array;
}): Promise<StatementIntakeDecision> {
  const sha256 = digestSourceBytes(input.bytes);
  const db = getDb();
  const [existingFile] = await db
    .select({ id: statementUploads.id })
    .from(statementUploads)
    .where(
      and(
        eq(statementUploads.organizationId, input.organizationId),
        eq(statementUploads.sha256, sha256),
      ),
    )
    .limit(1);

  const pages = await extractPdfPageTexts(input.bytes).catch(() => []);
  const parsed = parseBankStatementText(pages.join("\n"));
  const decision = decideStatementIntake({
    fileAlreadyStored: Boolean(existingFile),
    parsed,
    existingFingerprints: existingFile
      ? new Set<string>()
      : await existingFingerprints(input.organizationId),
  });

  if (decision.status === "rejected_duplicate_file") return decision;

  const uploadId = randomUUID();
  try {
    await getDocumentStore().storeOriginal({
      organizationId: input.organizationId,
      documentId: uploadId,
      originalFilename: input.filename,
      mimeType: "application/pdf",
      bytes: input.bytes,
    });
  } catch {
    // The ledger is the record of truth. A storage miss should not drop the transactions.
  }

  if (decision.status === "accepted") {
    const sourceFile = `upload:${sha256.slice(0, 16)}`;
    await db.insert(statementExpenseLines).values(
      decision.added.map((line, index) => ({
        organizationId: input.organizationId,
        businessDate: line.isoDate,
        description: line.description,
        expenseGroup: line.group,
        category: line.category,
        signedCents: line.signedCents,
        sourceFile,
        sourceIndex: index,
        fingerprint: line.fingerprint,
      })),
    );
  }

  await db.insert(statementUploads).values({
    id: uploadId,
    organizationId: input.organizationId,
    sha256,
    filename: input.filename.slice(0, 255),
    status: decision.status,
    startsOn: decision.status === "accepted" ? decision.startsOn : null,
    endsOn: decision.status === "accepted" ? decision.endsOn : null,
    parsedCount: parsed.length,
    addedCount: decision.status === "accepted" ? decision.added.length : 0,
    skippedCount: decision.status === "accepted" ? decision.skipped : 0,
    message: decision.message,
  });

  return decision;
}
