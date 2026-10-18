import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { organizations } from "@/db/schema";
import {
  payrollCalendarFromSettings,
  type PayrollCalendar,
} from "@/domain/payroll-calendar";
import { isIsoDate } from "@/lib/date-range";

export async function getPayrollCalendar(
  organizationId: string | null,
): Promise<PayrollCalendar> {
  if (!organizationId) return payrollCalendarFromSettings(null);
  const [row] = await getDb()
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return payrollCalendarFromSettings(row?.settings);
}

export async function savePayrollCalendar(input: {
  organizationId: string;
  anchor: string;
  periodDays: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isIsoDate(input.anchor)) {
    return { ok: false, message: "Choose the first day of a pay period." };
  }
  if (input.periodDays !== 7 && input.periodDays !== 14) {
    return { ok: false, message: "Pay periods are 7 or 14 days." };
  }

  const db = getDb();
  const [row] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);
  if (!row) return { ok: false, message: "This company could not be found." };

  const current =
    row.settings && typeof row.settings === "object" ? { ...row.settings } : {};
  await db
    .update(organizations)
    .set({
      settings: {
        ...current,
        payroll: { anchor: input.anchor, periodDays: input.periodDays },
      },
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, input.organizationId));

  return { ok: true };
}
