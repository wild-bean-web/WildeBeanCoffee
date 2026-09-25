import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, notInArray } from "drizzle-orm";
import {
  CloverApiError,
  CloverFetchReadClient,
  type CloverEmployee,
  type CloverPayment,
  type CloverShift,
} from "@/integrations/clover";
import { getDb } from "@/db/client";
import { integrationConnections, locations, payrollRuns, sourceDocuments } from "@/db/schema";
import type { JsonObject } from "@/db/schema/shared";
import { buildCloverLaborPreview } from "@/domain/payroll";
import type { ManagerSession } from "@/lib/auth/session";
import {
  addDaysIso,
  eachIsoDate,
  todayIso,
  zonedDayStartMs,
} from "@/lib/date-range";
import { getServerEnv } from "@/lib/env";
import { appendAuditEvent } from "@/services/audit/append";
import { cloverClientConfigForConnection } from "@/services/clover/connection-config";
import { requireLocationScope } from "@/services/locations/scope";
import { getDocumentStore } from "@/services/storage/document-store";
import { PayrollServiceError } from "./errors";
import {
  listLatestPostedPayrollRates,
  persistPayrollPreview,
} from "./runs";

const MAX_IMPORT_DAYS = 31;
const CLOVER_EMPLOYEES_MESSAGE =
  "This store's Clover token cannot read employees or the time clock. In Clover, create an API token with Employees (read), then paste it in Store setup. Clover does not send wage rates; hours are priced from the last posted Paychex preview.";

function asJson(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function filterWindow(startsOn: string, endsOn: string, timezone: string): string {
  const startMs = zonedDayStartMs(startsOn, timezone);
  const endMs = zonedDayStartMs(addDaysIso(endsOn, 1), timezone);
  return `in_time>=${startMs},in_time<${endMs}`;
}

function paymentWindow(startsOn: string, endsOn: string, timezone: string): string {
  const startMs = zonedDayStartMs(startsOn, timezone);
  const endMs = zonedDayStartMs(addDaysIso(endsOn, 1), timezone);
  return `createdTime>=${startMs},createdTime<${endMs}`;
}

function employeeLabel(employee: Pick<CloverEmployee, "id" | "name" | "nickname">): string {
  return employee.name?.trim() || employee.nickname?.trim() || `Employee ${employee.id}`;
}

async function collectList<T>(items: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  try {
    for await (const item of items) {
      collected.push(item);
    }
  } catch (error) {
    if (
      error instanceof CloverApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw new PayrollServiceError(
        CLOVER_EMPLOYEES_MESSAGE,
        502,
        "CLOVER_EMPLOYEES_FORBIDDEN",
      );
    }
    throw error;
  }
  return collected;
}

function shiftRecord(
  shift: CloverShift,
  names: Map<string, string>,
): {
  id: string;
  employeeId: string;
  employeeName: string;
  inTimeMs: number;
  outTimeMs: number;
  deleted: boolean;
} | null {
  const employeeId = shift.employee?.id;
  if (!employeeId) return null;
  const inTimeMs = shift.overrideInTime ?? shift.inTime ?? 0;
  const outTimeMs = shift.overrideOutTime ?? shift.outTime ?? 0;
  return {
    id: shift.id,
    employeeId,
    employeeName:
      shift.employee?.name?.trim() ||
      names.get(employeeId) ||
      `Employee ${employeeId}`,
    inTimeMs,
    outTimeMs,
    deleted: Boolean(shift.deletedTime),
  };
}

export async function importCloverLaborRange(
  session: ManagerSession,
  startsOn: string,
  endsOn: string,
) {
  const scope = requireLocationScope(session);
  const env = getServerEnv();
  if (!env.DATABASE_URL) {
    throw new PayrollServiceError(
      "The manager database is not configured.",
      400,
      "DATABASE_NOT_CONFIGURED",
    );
  }

  const db = getDb();
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, scope.organizationId),
        eq(integrationConnections.locationId, scope.locationId),
        eq(integrationConnections.sourceSystem, "clover"),
        eq(integrationConnections.status, "active"),
      ),
    )
    .limit(1);
  if (!connection?.locationId) {
    throw new PayrollServiceError(
      "Connect Clover for this store in Settings before importing the time clock.",
      409,
      "CLOVER_CONNECTION_MISSING",
    );
  }

  const [cafe] = await db
    .select({ timezone: locations.timezone, name: locations.name })
    .from(locations)
    .where(eq(locations.id, scope.locationId))
    .limit(1);
  const timezone = cafe?.timezone ?? env.MANAGER_TIMEZONE;
  const locationName =
    cafe?.name ??
    session.locations.find((location) => location.id === scope.locationId)
      ?.name ??
    "this store";
  const today = todayIso(timezone);
  const rangeEndsOn = endsOn > today ? today : endsOn;
  if (startsOn > rangeEndsOn) {
    throw new PayrollServiceError(
      "That date range is still in the future for this store.",
      400,
      "FUTURE_RANGE",
    );
  }
  let dates = eachIsoDate(startsOn, rangeEndsOn);
  if (dates.length > MAX_IMPORT_DAYS) {
    dates = dates.slice(-MAX_IMPORT_DAYS);
  }
  const rangeStartsOn = dates[0] ?? startsOn;
  const externalId = `labor:${rangeStartsOn}:${rangeEndsOn}`;

  const config = cloverClientConfigForConnection(connection);
  const client = new CloverFetchReadClient(config);
  const employees = await collectList(
    client.listEmployees({ maxPages: 20 }),
  );
  const names = new Map(
    employees.map((employee) => [employee.id, employeeLabel(employee)] as const),
  );
  const shifts = await collectList(
    client.listShifts({
      filter: filterWindow(rangeStartsOn, rangeEndsOn, timezone),
      expand: ["employee"],
      maxPages: 100,
    }),
  );
  let payments: CloverPayment[] = [];
  try {
    payments = await collectList(
      client.listPayments({
        filter: paymentWindow(rangeStartsOn, rangeEndsOn, timezone),
        expand: ["employee"],
        maxPages: 100,
      }),
    );
  } catch (error) {
    if (error instanceof PayrollServiceError) throw error;
    try {
      payments = await collectList(
        client.listPayments({
          filter: paymentWindow(rangeStartsOn, rangeEndsOn, timezone),
          maxPages: 100,
        }),
      );
    } catch (retryError) {
      if (retryError instanceof PayrollServiceError) throw retryError;
      payments = [];
    }
  }

  const rateCard = await listLatestPostedPayrollRates(session);
  const parsed = buildCloverLaborPreview({
    locationName,
    startsOn: rangeStartsOn,
    endsOn: rangeEndsOn,
    timeZone: timezone,
    shifts: shifts.flatMap((shift) => {
      const record = shiftRecord(shift, names);
      return record ? [record] : [];
    }),
    payments: payments.map((payment) => ({
      employeeId: payment.employee?.id ?? null,
      tipCents: payment.tipAmount ?? 0,
      result: payment.result,
    })),
    rates: rateCard.rates,
    employerTaxCents: rateCard.employerTaxCents,
    wagesCents: rateCard.wagesCents,
  });

  if (parsed.employeeCount === 0) {
    throw new PayrollServiceError(
      "Clover has no clocked shifts in that date range.",
      400,
      "CLOVER_SHIFTS_EMPTY",
    );
  }

  const [existing] = await db
    .select({
      id: sourceDocuments.id,
      status: sourceDocuments.status,
    })
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.organizationId, scope.organizationId),
        eq(sourceDocuments.locationId, scope.locationId),
        eq(sourceDocuments.sourceSystem, "clover"),
        eq(sourceDocuments.externalId, externalId),
        notInArray(sourceDocuments.status, ["voided", "duplicate"]),
      ),
    )
    .limit(1);

  if (existing) {
    const [run] = await db
      .select({ status: payrollRuns.status })
      .from(payrollRuns)
      .where(eq(payrollRuns.sourceDocumentId, existing.id))
      .limit(1);
    if (run?.status === "posted") {
      throw new PayrollServiceError(
        "Clover labor for this date range is already posted. Void it first if you need to import again.",
        409,
        "PAYROLL_PERIOD_EXISTS",
      );
    }
    const payrollRunId = await persistPayrollPreview({
      organizationId: scope.organizationId,
      locationId: scope.locationId,
      sourceDocumentId: existing.id,
      parsed,
    });
    await db
      .update(sourceDocuments)
      .set({
        documentDate: parsed.periodEndsOn,
        totalCents: parsed.loadedLaborCents,
        metadata: asJson({
          documentKind: "payroll",
          laborSource: "clover_time_clock",
          unmatchedEmployeeNames: parsed.unmatchedEmployeeNames,
          estimatedEmployerTax: parsed.estimatedEmployerTax,
        }),
        updatedAt: new Date(),
      })
      .where(eq(sourceDocuments.id, existing.id));
    return {
      documentId: existing.id,
      payrollRunId,
      startsOn: rangeStartsOn,
      endsOn: rangeEndsOn,
      employeeCount: parsed.employeeCount,
      loadedLaborCents: parsed.loadedLaborCents,
      unmatchedEmployeeCount: parsed.unmatchedEmployeeNames.length,
      estimatedEmployerTax: parsed.estimatedEmployerTax,
    };
  }

  const documentId = randomUUID();
  const bytes = new TextEncoder().encode(
    JSON.stringify(
      {
        source: "clover_time_clock",
        startsOn: rangeStartsOn,
        endsOn: rangeEndsOn,
        employeeCount: parsed.employeeCount,
        loadedLaborCents: parsed.loadedLaborCents,
        unmatchedEmployeeNames: parsed.unmatchedEmployeeNames,
        capturedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  const stored = await getDocumentStore().storeOriginal({
    organizationId: scope.organizationId,
    documentId,
    originalFilename: `clover-labor-${rangeStartsOn}-to-${rangeEndsOn}.json`,
    mimeType: "application/json",
    bytes,
  });

  try {
    await db.insert(sourceDocuments).values({
      id: documentId,
      organizationId: scope.organizationId,
      locationId: scope.locationId,
      documentType: "payroll",
      status: "needs_review",
      sourceSystem: "clover",
      externalId,
      storageKey: stored.objectKey,
      originalFileName: `clover-labor-${rangeStartsOn}-to-${rangeEndsOn}.json`,
      mimeType: "application/json",
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      documentDate: parsed.periodEndsOn,
      currency: "USD",
      totalCents: parsed.loadedLaborCents,
      metadata: {
        documentKind: "payroll",
        laborSource: "clover_time_clock",
        sensitivity: "confidential",
        captureChannel: "clover_import",
        unmatchedEmployeeNames: parsed.unmatchedEmployeeNames,
        estimatedEmployerTax: parsed.estimatedEmployerTax,
      },
    });
  } catch (error) {
    try {
      await getDocumentStore().removeOriginal(stored.objectKey);
    } catch {
      // The source row was not created.
    }
    throw error;
  }

  const payrollRunId = await persistPayrollPreview({
    organizationId: scope.organizationId,
    locationId: scope.locationId,
    sourceDocumentId: documentId,
    parsed,
  });

  await appendAuditEvent({
    organizationId: scope.organizationId,
    actorType: "staff",
    actorStaffMemberId: session.staffMemberId ?? undefined,
    actorExternalId: session.userId,
    sourceSystem: "clover",
    action: "payroll.clover_imported",
    entityType: "payroll_run",
    entityId: payrollRunId,
    eventData: {
      documentId,
      startsOn: rangeStartsOn,
      endsOn: rangeEndsOn,
      employeeCount: parsed.employeeCount,
      loadedLaborCents: parsed.loadedLaborCents,
    },
  });

  return {
    documentId,
    payrollRunId,
    startsOn: rangeStartsOn,
    endsOn: rangeEndsOn,
    employeeCount: parsed.employeeCount,
    loadedLaborCents: parsed.loadedLaborCents,
    unmatchedEmployeeCount: parsed.unmatchedEmployeeNames.length,
    estimatedEmployerTax: parsed.estimatedEmployerTax,
  };
}
