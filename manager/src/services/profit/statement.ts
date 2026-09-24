import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";
import { buildStatementPnl, type StatementPnl } from "@/domain/statement-pnl";
import { getDb } from "@/db/client";
import { dailySalesControls } from "@/db/schema";
import type { ManagerSession } from "@/lib/auth/session";
import type { DateRange } from "@/lib/date-range";
import { getServerEnv } from "@/lib/env";
import { loadStatementExpenses } from "@/services/expenses/ledger";
import { locationScope } from "@/services/locations/scope";

export async function getStatementPnl(
  session: ManagerSession,
  range: DateRange | null,
): Promise<StatementPnl> {
  const expenses = loadStatementExpenses(range, "all");
  const scope = locationScope(session);
  if (!scope || !getServerEnv().DATABASE_URL) {
    return buildStatementPnl([], expenses);
  }

  const filters = [
    eq(dailySalesControls.organizationId, scope.organizationId),
    eq(dailySalesControls.locationId, scope.locationId),
  ];
  if (range) {
    filters.push(
      gte(dailySalesControls.businessDate, range.startsOn),
      lte(dailySalesControls.businessDate, range.endsOn),
    );
  }

  const rows = await getDb()
    .select({
      businessDate: dailySalesControls.businessDate,
      sourceSystem: dailySalesControls.sourceSystem,
      grossCents: dailySalesControls.grossCents,
      discountCents: dailySalesControls.discountCents,
      refundCents: dailySalesControls.refundCents,
      taxCents: dailySalesControls.taxCents,
      tipCents: dailySalesControls.tipCents,
      netCollectedCents: dailySalesControls.netCollectedCents,
    })
    .from(dailySalesControls)
    .where(and(...filters));

  return buildStatementPnl(rows, expenses);
}
