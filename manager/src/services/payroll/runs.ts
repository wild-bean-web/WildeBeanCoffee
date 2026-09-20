import "server-only";

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  accountingPeriods,
  payrollEmployees,
  payrollRuns,
  sourceDocuments,
} from "@/db/schema";
import type { JsonObject } from "@/db/schema/shared";
import {
  assertDocumentTransition,
  IllegalDocumentTransitionError,
  type DocumentStatus,
} from "@/domain/documents";
import type { ParsedPayrollPreview } from "@/domain/payroll";
import type { ManagerSession } from "@/lib/auth/session";
import { appendAuditEvent } from "@/services/audit/append";
import { locationScope, requireLocationScope } from "@/services/locations/scope";
import { getDocumentStore } from "@/services/storage/document-store";
import { PayrollServiceError } from "./errors";

function asJson(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function snapshotOf(parsed: ParsedPayrollPreview): JsonObject {
  return asJson({
    companyName: parsed.companyName,
    checkDate: parsed.checkDate,
    periodStartsOn: parsed.periodStartsOn,
    periodEndsOn: parsed.periodEndsOn,
    employeeCount: parsed.employeeCount,
    loadedLaborCents: parsed.loadedLaborCents,
    employees: parsed.employees,
    ...(parsed.laborSource ? { laborSource: parsed.laborSource } : {}),
    ...(parsed.unmatchedEmployeeNames
      ? { unmatchedEmployeeNames: parsed.unmatchedEmployeeNames }
      : {}),
    ...(parsed.estimatedEmployerTax
      ? { estimatedEmployerTax: parsed.estimatedEmployerTax }
      : {}),
  });
}

async function periodForDate(organizationId: string, on: string | null) {
  if (!on) return null;
  const [period] = await getDb()
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.organizationId, organizationId),
        lte(accountingPeriods.startsOn, on),
        gte(accountingPeriods.endsOn, on),
      ),
    )
    .limit(1);
  return period?.id ?? null;
}

export async function persistPayrollPreview(input: {
  organizationId: string;
  locationId: string;
  sourceDocumentId: string;
  parsed: ParsedPayrollPreview;
}) {
  const db = getDb();
  const accountingPeriodId = await periodForDate(
    input.organizationId,
    input.parsed.periodEndsOn ?? input.parsed.checkDate,
  );
  const values = {
    organizationId: input.organizationId,
    locationId: input.locationId,
    sourceDocumentId: input.sourceDocumentId,
    accountingPeriodId,
    status: "draft" as const,
    companyName: input.parsed.companyName,
    checkDate: input.parsed.checkDate,
    periodStartsOn: input.parsed.periodStartsOn,
    periodEndsOn: input.parsed.periodEndsOn,
    batchReference: input.parsed.batchReference,
    employeeCount: input.parsed.employeeCount,
    regularHours: input.parsed.regularHours,
    overtimeHours: input.parsed.overtimeHours,
    totalHours: input.parsed.totalHours,
    regularWagesCents: input.parsed.regularWagesCents,
    overtimeWagesCents: input.parsed.overtimeWagesCents,
    tipsCents: input.parsed.tipsCents,
    wagesCents: input.parsed.wagesCents,
    grossCents: input.parsed.grossCents,
    employeeTaxCents: input.parsed.employeeTaxCents,
    netPayCents: input.parsed.netPayCents,
    employerTaxCents: input.parsed.employerTaxCents,
    loadedLaborCents: input.parsed.loadedLaborCents,
    snapshot: snapshotOf(input.parsed),
  };

  const [existing] = await db
    .select({ id: payrollRuns.id, status: payrollRuns.status })
    .from(payrollRuns)
    .where(eq(payrollRuns.sourceDocumentId, input.sourceDocumentId))
    .limit(1);

  if (existing?.status === "posted") {
    return existing.id;
  }

  let runId = existing?.id;
  if (runId) {
    await db
      .update(payrollRuns)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(payrollRuns.id, runId));
    await db.delete(payrollEmployees).where(eq(payrollEmployees.payrollRunId, runId));
  } else {
    if (
      input.parsed.periodStartsOn &&
      input.parsed.periodEndsOn &&
      input.parsed.checkDate
    ) {
      const [conflict] = await db
        .select({
          id: payrollRuns.id,
          sourceDocumentId: payrollRuns.sourceDocumentId,
        })
        .from(payrollRuns)
        .where(
          and(
            eq(payrollRuns.locationId, input.locationId),
            eq(payrollRuns.periodStartsOn, input.parsed.periodStartsOn),
            eq(payrollRuns.periodEndsOn, input.parsed.periodEndsOn),
            eq(payrollRuns.checkDate, input.parsed.checkDate),
            inArray(payrollRuns.status, ["draft", "posted"]),
          ),
        )
        .limit(1);
      if (conflict) {
        throw new PayrollServiceError(
          "A payroll preview for this pay period is already on this location. Void the existing draft or posted run first if this is a replacement.",
          409,
          "PAYROLL_PERIOD_EXISTS",
        );
      }
    }
    const [created] = await db
      .insert(payrollRuns)
      .values(values)
      .returning({ id: payrollRuns.id });
    runId = created.id;
  }

  if (input.parsed.employees.length > 0) {
    await db.insert(payrollEmployees).values(
      input.parsed.employees.map((employee, index) => ({
        organizationId: input.organizationId,
        payrollRunId: runId as string,
        lineNumber: index + 1,
        displayName: employee.displayName,
        familyName: employee.familyName,
        givenName: employee.givenName,
        regularHours: employee.regularHours,
        overtimeHours: employee.overtimeHours,
        totalHours: employee.totalHours,
        regularRate: employee.regularRate,
        overtimeRate: employee.overtimeRate,
        regularWagesCents: employee.regularWagesCents,
        overtimeWagesCents: employee.overtimeWagesCents,
        tipsCents: employee.tipsCents,
        wagesCents: employee.wagesCents,
        grossCents: employee.grossCents,
        employeeTaxCents: employee.employeeTaxCents,
        netPayCents: employee.netPayCents,
        employerTaxCents: employee.employerTaxCents,
        loadedLaborCents: employee.loadedLaborCents,
        earnings: asJson({ items: employee.earnings }),
        employeeTaxes: asJson({ items: employee.employeeTaxes }),
        employerLiabilities: asJson({ items: employee.employerLiabilities }),
      })),
    );
  }

  return runId as string;
}

export async function getPayrollRunForDocument(
  session: ManagerSession,
  documentId: string,
) {
  const scope = requireLocationScope(session);
  const [run] = await getDb()
    .select()
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.sourceDocumentId, documentId),
        eq(payrollRuns.organizationId, scope.organizationId),
        eq(payrollRuns.locationId, scope.locationId),
      ),
    )
    .limit(1);
  if (!run) return null;
  const employees = await getDb()
    .select()
    .from(payrollEmployees)
    .where(eq(payrollEmployees.payrollRunId, run.id))
    .orderBy(asc(payrollEmployees.lineNumber));
  return { run, employees };
}

export async function listPayrollRuns(
  session: ManagerSession,
  limitOrOptions: number | { limit?: number; startsOn?: string; endsOn?: string } = 24,
) {
  const options =
    typeof limitOrOptions === "number"
      ? { limit: limitOrOptions }
      : { limit: 24, ...limitOrOptions };
  const scope = locationScope(session);
  if (!scope) return [];
  const filters = [
    eq(payrollRuns.organizationId, scope.organizationId),
    eq(payrollRuns.locationId, scope.locationId),
    inArray(payrollRuns.status, ["draft", "posted"]),
  ];
  if (options.startsOn && options.endsOn) {
    filters.push(lte(payrollRuns.periodStartsOn, options.endsOn));
    filters.push(gte(payrollRuns.periodEndsOn, options.startsOn));
  }
  return getDb()
    .select()
    .from(payrollRuns)
    .where(and(...filters))
    .orderBy(desc(payrollRuns.periodEndsOn), desc(payrollRuns.createdAt))
    .limit(Math.min(Math.max(options.limit ?? 24, 1), 100));
}

export async function listPostedPayrollForPeriod(
  session: ManagerSession,
  startsOn: string,
  endsOn: string,
  mode: "period-end" | "overlap" = "period-end",
) {
  const scope = locationScope(session);
  if (!scope) return [];
  const periodFilter =
    mode === "overlap"
      ? and(
          lte(payrollRuns.periodStartsOn, endsOn),
          gte(payrollRuns.periodEndsOn, startsOn),
        )
      : and(
          gte(payrollRuns.periodEndsOn, startsOn),
          lte(payrollRuns.periodEndsOn, endsOn),
        );
  return getDb()
    .select()
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.organizationId, scope.organizationId),
        eq(payrollRuns.locationId, scope.locationId),
        eq(payrollRuns.status, "posted"),
        periodFilter,
      ),
    )
    .orderBy(asc(payrollRuns.periodEndsOn));
}

export async function postPayrollDocument(
  session: ManagerSession,
  documentId: string,
) {
  const scope = requireLocationScope(session);
  const db = getDb();
  const [document] = await db
    .select()
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.id, documentId),
        eq(sourceDocuments.organizationId, scope.organizationId),
        eq(sourceDocuments.locationId, scope.locationId),
      ),
    )
    .limit(1);
  if (!document) {
    throw new PayrollServiceError(
      "That payroll document is not in this location.",
      404,
      "PAYROLL_DOCUMENT_NOT_FOUND",
    );
  }
  if (document.status === "posted") {
    const existing = await getPayrollRunForDocument(session, document.id);
    return {
      documentId: document.id,
      status: "posted" as const,
      payrollRunId: existing?.run.id ?? null,
      loadedLaborCents: existing?.run.loadedLaborCents ?? 0,
    };
  }
  if (document.documentType !== "payroll") {
    throw new PayrollServiceError(
      "This file is not a payroll preview.",
      409,
      "NOT_PAYROLL",
    );
  }

  const workspace = await getPayrollRunForDocument(session, document.id);
  if (!workspace || workspace.employees.length === 0) {
    throw new PayrollServiceError(
      "Review the extracted employees before posting labor cost.",
      409,
      "PAYROLL_NOT_EXTRACTED",
    );
  }

  const fromStatus = document.status as DocumentStatus;
  const postedAt = new Date();
  try {
    await db.transaction(async (transaction) => {
      if (fromStatus !== "approved") {
        assertDocumentTransition(fromStatus, "approved");
        await transaction
          .update(sourceDocuments)
          .set({ status: "approved", updatedAt: postedAt })
          .where(eq(sourceDocuments.id, document.id));
      }
      assertDocumentTransition("approved", "posted");
      await transaction
        .update(payrollRuns)
        .set({
          status: "posted",
          postedAt,
          postedByStaffMemberId: session.staffMemberId,
          updatedAt: postedAt,
        })
        .where(eq(payrollRuns.id, workspace.run.id));
      await transaction
        .update(sourceDocuments)
        .set({
          status: "posted",
          documentDate: workspace.run.checkDate,
          totalCents: workspace.run.loadedLaborCents,
          updatedAt: postedAt,
        })
        .where(eq(sourceDocuments.id, document.id));
    });
  } catch (error) {
    if (error instanceof IllegalDocumentTransitionError) {
      throw new PayrollServiceError(
        "This payroll preview cannot be posted yet.",
        409,
        "ILLEGAL_DOCUMENT_TRANSITION",
      );
    }
    throw error;
  }

  await appendAuditEvent({
    organizationId: scope.organizationId,
    actorType: "staff",
    actorStaffMemberId: session.staffMemberId ?? undefined,
    actorExternalId: session.userId,
    sourceSystem: "manager_web",
    action: "payroll.posted",
    entityType: "payroll_run",
    entityId: workspace.run.id,
    eventData: {
      documentId: document.id,
      loadedLaborCents: workspace.run.loadedLaborCents,
      employeeCount: workspace.run.employeeCount,
    },
  });

  return {
    documentId: document.id,
    status: "posted" as const,
    payrollRunId: workspace.run.id,
    loadedLaborCents: workspace.run.loadedLaborCents,
  };
}

export async function voidPayrollDocument(
  session: ManagerSession,
  documentId: string,
) {
  const scope = requireLocationScope(session);
  if (!session.staffMemberId) {
    throw new PayrollServiceError(
      "The manager account is not linked to an active staff record.",
      400,
      "PAYROLL_VOID_UNAVAILABLE",
    );
  }

  const db = getDb();
  const [document] = await db
    .select()
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.id, documentId),
        eq(sourceDocuments.organizationId, scope.organizationId),
        eq(sourceDocuments.locationId, scope.locationId),
      ),
    )
    .limit(1);
  if (!document) {
    throw new PayrollServiceError(
      "That payroll document is not in this location.",
      404,
      "PAYROLL_DOCUMENT_NOT_FOUND",
    );
  }
  if (document.documentType !== "payroll") {
    throw new PayrollServiceError(
      "This file is not a payroll preview.",
      409,
      "NOT_PAYROLL",
    );
  }

  const fromStatus = document.status as DocumentStatus;
  if (fromStatus === "voided") {
    return { documentId: document.id, status: "voided" as const };
  }
  if (fromStatus !== "posted") {
    try {
      assertDocumentTransition(fromStatus, "voided");
    } catch (error) {
      if (error instanceof IllegalDocumentTransitionError) {
        throw new PayrollServiceError(
          "This payroll preview cannot be voided yet.",
          409,
          "ILLEGAL_DOCUMENT_TRANSITION",
        );
      }
      throw error;
    }
  }

  const workspace = await getPayrollRunForDocument(session, document.id);
  const voidedAt = new Date();

  const updated = await db.transaction(async (transaction) => {
    if (workspace && workspace.run.status !== "voided") {
      await transaction
        .update(payrollRuns)
        .set({
          status: "voided",
          updatedAt: voidedAt,
        })
        .where(eq(payrollRuns.id, workspace.run.id));
    }
    const [row] = await transaction
      .update(sourceDocuments)
      .set({
        status: "voided",
        updatedAt: voidedAt,
        metadata: {
          ...document.metadata,
          voidedByStaffMemberId: session.staffMemberId,
          voidedAt: voidedAt.toISOString(),
          voidReason:
            fromStatus === "posted"
              ? "posted_payroll_voided"
              : "payroll_preview_removed",
        },
      })
      .where(
        and(
          eq(sourceDocuments.id, document.id),
          eq(sourceDocuments.status, document.status),
        ),
      )
      .returning({ id: sourceDocuments.id });
    return row;
  });

  if (!updated) {
    throw new PayrollServiceError(
      "The payroll preview could not be voided because its status changed.",
      409,
      "PAYROLL_STATUS_CHANGED",
    );
  }

  await appendAuditEvent({
    organizationId: scope.organizationId,
    actorType: "staff",
    actorStaffMemberId: session.staffMemberId,
    actorExternalId: session.userId,
    sourceSystem: "manager_web",
    action:
      fromStatus === "posted" ? "payroll.voided" : "payroll.preview_removed",
    entityType: "payroll_run",
    entityId: workspace?.run.id ?? document.id,
    eventData: {
      documentId: document.id,
      previousDocumentStatus: fromStatus,
      previousRunStatus: workspace?.run.status ?? null,
      loadedLaborCents: workspace?.run.loadedLaborCents ?? 0,
      periodStartsOn: workspace?.run.periodStartsOn ?? null,
      periodEndsOn: workspace?.run.periodEndsOn ?? null,
    },
  });

  try {
    await getDocumentStore().removeOriginal(document.storageKey);
  } catch {
    // The payroll row is already voided. Storage cleanup can be retried later.
  }

  return { documentId: document.id, status: "voided" as const };
}

export async function listLatestPostedPayrollRates(session: ManagerSession) {
  const scope = locationScope(session);
  if (!scope) {
    return { rates: [], employerTaxCents: 0, wagesCents: 0 };
  }
  const [latest] = await getDb()
    .select({
      id: payrollRuns.id,
      employerTaxCents: payrollRuns.employerTaxCents,
      wagesCents: payrollRuns.wagesCents,
    })
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.organizationId, scope.organizationId),
        eq(payrollRuns.locationId, scope.locationId),
        eq(payrollRuns.status, "posted"),
      ),
    )
    .orderBy(desc(payrollRuns.periodEndsOn), desc(payrollRuns.postedAt))
    .limit(1);
  if (!latest) {
    return { rates: [], employerTaxCents: 0, wagesCents: 0 };
  }
  const rates = await getDb()
    .select({
      displayName: payrollEmployees.displayName,
      familyName: payrollEmployees.familyName,
      givenName: payrollEmployees.givenName,
      regularRate: payrollEmployees.regularRate,
      overtimeRate: payrollEmployees.overtimeRate,
    })
    .from(payrollEmployees)
    .where(eq(payrollEmployees.payrollRunId, latest.id));
  return {
    rates,
    employerTaxCents: latest.employerTaxCents,
    wagesCents: latest.wagesCents,
  };
}
