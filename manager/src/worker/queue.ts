import { PgBoss } from "pg-boss";
import { getServerEnv } from "@/lib/env";

export const jobNames = {
  documentProcess: "document.process",
  cloverEvent: "clover.event",
  cloverReconcile: "clover.reconcile",
  storefrontEvent: "storefront.event",
} as const;

export type JobName = (typeof jobNames)[keyof typeof jobNames];

let bossPromise: Promise<PgBoss> | undefined;

async function startBoss(): Promise<PgBoss> {
  const { DATABASE_URL } = getServerEnv();
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required for background jobs.");
  }

  const boss = new PgBoss({
    connectionString: DATABASE_URL,
    schema: "manager_jobs",
    application_name: "wild-bean-manager-worker",
  });

  boss.on("error", (error) => {
    console.error("Manager queue error", {
      name: error.name,
      message: error.message,
    });
  });

  await boss.start();
  await Promise.all(
    Object.values(jobNames).map((name) =>
      boss.createQueue(name, {
        policy: "short",
        expireInSeconds: 60 * 60,
        retentionSeconds: 60 * 60 * 24 * 14,
        deleteAfterSeconds: 60 * 60 * 24 * 7,
        retryLimit: 5,
        retryDelay: 15,
        retryBackoff: true,
      }),
    ),
  );

  return boss;
}

export function getJobQueue(): Promise<PgBoss> {
  bossPromise ??= startBoss();
  return bossPromise;
}

export async function enqueueJob<T extends object>(
  name: JobName,
  data: T,
  singletonKey?: string,
): Promise<string> {
  const boss = await getJobQueue();
  const id = await boss.send(name, data, {
    ...(singletonKey ? { singletonKey } : {}),
  });

  if (!id) {
    throw new Error(`Job ${name} was not queued.`);
  }

  return id;
}

export async function stopJobQueue(): Promise<void> {
  if (!bossPromise) return;
  const boss = await bossPromise;
  await boss.stop({ graceful: true, timeout: 30_000 });
  bossPromise = undefined;
}
