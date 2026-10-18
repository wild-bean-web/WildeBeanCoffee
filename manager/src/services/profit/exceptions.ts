import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { bookExceptions, type BookException } from "@/domain/book-exceptions";
import { getDb } from "@/db/client";
import {
  dailySalesControls,
  products,
  statementExpenseLines,
} from "@/db/schema";
import type { ManagerSession } from "@/lib/auth/session";
import { previousPayrollPeriod, todayIso } from "@/lib/date-range";
import { formatShortDate } from "@/lib/format";
import { getServerEnv } from "@/lib/env";
import { locationScope } from "@/services/locations/scope";
import { listPostedPayrollForPeriod } from "@/services/payroll/runs";
import { getPayrollCalendar } from "@/services/payroll/calendar";

export async function getBookExceptions(
  session: ManagerSession,
): Promise<BookException[]> {
  const scope = locationScope(session);
  if (!scope || !getServerEnv().DATABASE_URL) return [];

  const db = getDb();
  const today = todayIso();
  const calendar = await getPayrollCalendar(scope.organizationId);
  const previous = previousPayrollPeriod(today, calendar.anchor, calendar.periodDays);

  const [salesRow, expenseRow, unnamedRow, productRow, posted] = await Promise.all([
    db
      .select({ businessDate: dailySalesControls.businessDate })
      .from(dailySalesControls)
      .where(
        and(
          eq(dailySalesControls.organizationId, scope.organizationId),
          eq(dailySalesControls.locationId, scope.locationId),
        ),
      )
      .orderBy(desc(dailySalesControls.businessDate))
      .limit(1),
    db
      .select({ businessDate: statementExpenseLines.businessDate })
      .from(statementExpenseLines)
      .where(eq(statementExpenseLines.organizationId, scope.organizationId))
      .orderBy(desc(statementExpenseLines.businessDate))
      .limit(1),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(statementExpenseLines)
      .where(
        and(
          eq(statementExpenseLines.organizationId, scope.organizationId),
          inArray(statementExpenseLines.expenseGroup, ["unknown", "unassigned"]),
        ),
      ),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(products)
      .where(
        and(
          eq(products.organizationId, scope.organizationId),
          eq(products.isActive, true),
          eq(products.trackInventory, true),
        ),
      ),
    listPostedPayrollForPeriod(session, previous.startsOn, previous.endsOn, "overlap"),
  ]);

  return bookExceptions({
    today,
    salesLast: salesRow[0]?.businessDate ?? null,
    expenseLast: expenseRow[0]?.businessDate ?? null,
    salesLastLabel: salesRow[0] ? formatShortDate(salesRow[0].businessDate) : null,
    expenseLastLabel: expenseRow[0] ? formatShortDate(expenseRow[0].businessDate) : null,
    unnamedCount: Number(unnamedRow[0]?.value ?? 0),
    productCount: Number(productRow[0]?.value ?? 0),
    previousPayrollPosted: posted.length > 0,
    previousPayrollLabel: `${formatShortDate(previous.startsOn)} – ${formatShortDate(previous.endsOn)}`,
  });
}
