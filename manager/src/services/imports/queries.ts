import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { importBatches } from "@/db/schema";
import type { ManagerSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";

export async function listImportBatches(
  session: ManagerSession,
  limit = 20,
) {
  if (!getServerEnv().DATABASE_URL || !session.organizationId) return [];
  return getDb()
    .select()
    .from(importBatches)
    .where(eq(importBatches.organizationId, session.organizationId))
    .orderBy(desc(importBatches.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
}
