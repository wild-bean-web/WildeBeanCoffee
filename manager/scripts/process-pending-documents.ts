import { eq } from "drizzle-orm";
import { closeDatabase, getDb } from "../src/db/client";
import { sourceDocuments } from "../src/db/schema";
import { processSourceDocument } from "../src/services/documents/process";

async function main(): Promise<void> {
  const pending = await getDb()
    .select({
      id: sourceDocuments.id,
      originalFileName: sourceDocuments.originalFileName,
      status: sourceDocuments.status,
    })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.status, "received"));

  for (const document of pending) {
    const result = await processSourceDocument(document.id);
    console.info("Processed pending document", {
      id: document.id,
      originalFileName: document.originalFileName,
      status: result.status,
      extractionRunId: result.extractionRunId,
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Pending document processing failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown failure",
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
