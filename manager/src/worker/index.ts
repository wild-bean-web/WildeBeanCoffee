import { getJobQueue, jobNames, stopJobQueue } from "./queue";
import { processSourceDocument } from "@/services/documents/process";
import { processCloverIntegrationEvent } from "@/services/clover/process-event";
import { reconcileCloverBusinessDate } from "@/services/clover/reconcile-day";
import { processStorefrontIntegrationEvent } from "@/services/storefront/process-event";

interface DocumentProcessJob {
  documentId: string;
  stageVersion: number;
}

interface CloverReconcileJob {
  organizationId: string;
  locationId?: string;
  businessDate: string;
}

interface CloverEventJob {
  integrationEventId: string;
}

interface StorefrontEventJob {
  integrationEventId: string;
}

async function main(): Promise<void> {
  const boss = await getJobQueue();

  await boss.work<DocumentProcessJob>(
    jobNames.documentProcess,
    { batchSize: 1, localConcurrency: 2 },
    async ([job]) => {
      const result = await processSourceDocument(job.data.documentId);
      console.info("Document processing job completed", {
        jobId: job.id,
        documentId: job.data.documentId,
        stageVersion: job.data.stageVersion,
        status: result.status,
      });
      return result;
    },
  );

  await boss.work<CloverReconcileJob>(
    jobNames.cloverReconcile,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      const result = await reconcileCloverBusinessDate({
        organizationId: job.data.organizationId,
        locationId: job.data.locationId,
        businessDate: job.data.businessDate,
      });
      console.info("Clover reconciliation job completed", {
        jobId: job.id,
        organizationId: job.data.organizationId,
        locationId: job.data.locationId,
        businessDate: job.data.businessDate,
        status: result.status,
      });
      return { status: result.status };
    },
  );

  await boss.work<CloverEventJob>(
    jobNames.cloverEvent,
    { batchSize: 10, localConcurrency: 2 },
    async (jobs) => {
      const results = [];
      for (const job of jobs) {
        results.push(
          await processCloverIntegrationEvent(job.data.integrationEventId),
        );
      }
      console.info("Clover event batch completed", { count: results.length });
      return { processed: results.length };
    },
  );

  await boss.work<StorefrontEventJob>(
    jobNames.storefrontEvent,
    { batchSize: 10, localConcurrency: 1 },
    async (jobs) => {
      let linkedToClover = 0;
      for (const job of jobs) {
        const result = await processStorefrontIntegrationEvent(
          job.data.integrationEventId,
        );
        if (result.linkedToClover) linkedToClover += 1;
      }
      console.info("Storefront event batch completed", {
        count: jobs.length,
        linkedToClover,
      });
      return { processed: jobs.length, linkedToClover };
    },
  );

  console.info("Wild Bean manager worker is ready", {
    queues: Object.values(jobNames),
  });
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.info("Manager worker shutting down", { signal });
  await stopJobQueue();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

main().catch(async (error: unknown) => {
  console.error("Manager worker failed to start", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown failure",
  });
  await stopJobQueue();
  process.exit(1);
});
