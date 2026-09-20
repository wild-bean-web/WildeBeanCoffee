import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { accountingPeriods, type DailySalesControl } from "@/db/schema";
import {
  contributionAfterPrimeCents,
  largestCostLine,
  PRIME_COST_BENCHMARKS,
  primeCostCents,
  salesRatio,
  type ProfitCostLine,
} from "@/domain/profit";
import type { ManagerSession } from "@/lib/auth/session";
import { getCloseCostingPreview } from "@/services/inventory/queries";
import { locationScope } from "@/services/locations/scope";
import {
  listPayrollRuns,
  listPostedPayrollForPeriod,
} from "@/services/payroll/runs";
import { listDailySalesControlsForRange } from "@/services/sales/queries";

function preferSalesRow(
  current: DailySalesControl | undefined,
  next: DailySalesControl,
): DailySalesControl {
  if (!current) return next;
  const currentClover = /clover/i.test(current.sourceSystem);
  const nextClover = /clover/i.test(next.sourceSystem);
  if (nextClover && !currentClover) return next;
  if (currentClover && !nextClover) return current;
  return next.netCollectedCents > current.netCollectedCents ? next : current;
}

function netSalesFromRow(row: DailySalesControl): number {
  const productSales = row.grossCents - row.discountCents - row.refundCents;
  if (productSales > 0) return productSales;
  const collectedLessPassThrough =
    row.netCollectedCents - row.taxCents - row.tipCents;
  return Math.max(collectedLessPassThrough, 0);
}

async function periodContaining(organizationId: string, on: string) {
  const [period] = await getDb()
    .select({
      id: accountingPeriods.id,
      name: accountingPeriods.name,
      status: accountingPeriods.status,
      startsOn: accountingPeriods.startsOn,
      endsOn: accountingPeriods.endsOn,
    })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.organizationId, organizationId),
        lte(accountingPeriods.startsOn, on),
        gte(accountingPeriods.endsOn, on),
      ),
    )
    .limit(1);
  return period ?? null;
}

export async function getLocationPnl(
  session: ManagerSession,
  range?: { startsOn: string; endsOn: string },
) {
  const scope = locationScope(session);
  const costing = await getCloseCostingPreview(session);
  const currentPeriod = costing.snapshot.currentPeriod;
  if (!scope || !currentPeriod) {
    return {
      status: "awaiting_period" as const,
      period: null,
      periodNote: null as string | null,
      netSalesCents: 0,
      taxCents: 0,
      tipCents: 0,
      salesDays: 0,
      cogsCents: null as number | null,
      wasteCents: null as number | null,
      loadedLaborCents: 0,
      wagesCents: 0,
      employerTaxCents: 0,
      payrollRuns: [] as Awaited<ReturnType<typeof listPostedPayrollForPeriod>>,
      primeCostCents: 0,
      contributionCents: 0,
      lines: [] as ProfitCostLine[],
      largestCost: null as ProfitCostLine | null,
      ratios: {
        cogs: null as number | null,
        labor: null as number | null,
        prime: null as number | null,
      },
      benchmarks: PRIME_COST_BENCHMARKS,
      costingStatus: costing.status,
    };
  }

  const salesInCurrent = await listDailySalesControlsForRange(
    session,
    currentPeriod.startsOn,
    currentPeriod.endsOn,
  );
  const payrollInCurrent = await listPostedPayrollForPeriod(
    session,
    currentPeriod.startsOn,
    currentPeriod.endsOn,
  );

  let period = currentPeriod;
  let periodNote: string | null = null;
  if (range) {
    const named = await periodContaining(scope.organizationId, range.endsOn);
    const exact =
      named &&
      named.startsOn === range.startsOn &&
      named.endsOn === range.endsOn;
    period = exact
      ? named
      : {
          id: named?.id ?? "custom-range",
          name: "Custom range",
          status: named?.status ?? "open",
          startsOn: range.startsOn,
          endsOn: range.endsOn,
        };
  } else if (salesInCurrent.length === 0 && payrollInCurrent.length === 0) {
    const latestPosted = (await listPayrollRuns(session, 8)).find(
      (run) => run.status === "posted" && run.periodEndsOn,
    );
    if (latestPosted?.periodEndsOn) {
      const activityPeriod = await periodContaining(
        scope.organizationId,
        latestPosted.periodEndsOn,
      );
      if (activityPeriod && activityPeriod.id !== currentPeriod.id) {
        periodNote = `Showing ${activityPeriod.name} because ${currentPeriod.name} has no posted sales or labor yet.`;
        period = activityPeriod;
      }
    }
  }

  const salesRows =
    !range &&
    period.startsOn === currentPeriod.startsOn &&
    period.endsOn === currentPeriod.endsOn
      ? salesInCurrent
      : await listDailySalesControlsForRange(
          session,
          period.startsOn,
          period.endsOn,
        );
  const byDate = new Map<string, DailySalesControl>();
  for (const row of salesRows) {
    byDate.set(
      row.businessDate,
      preferSalesRow(byDate.get(row.businessDate), row),
    );
  }
  const uniqueDays = [...byDate.values()];
  const netSalesCents = uniqueDays.reduce(
    (sum, row) => sum + netSalesFromRow(row),
    0,
  );
  const taxCents = uniqueDays.reduce((sum, row) => sum + row.taxCents, 0);
  const tipCents = uniqueDays.reduce((sum, row) => sum + row.tipCents, 0);

  const payrollMode =
    period.startsOn === currentPeriod.startsOn &&
    period.endsOn === currentPeriod.endsOn
      ? "period-end"
      : "overlap";
  const payrollRuns =
    !range &&
    period.startsOn === currentPeriod.startsOn &&
    period.endsOn === currentPeriod.endsOn
      ? payrollInCurrent
      : await listPostedPayrollForPeriod(
          session,
          period.startsOn,
          period.endsOn,
          payrollMode,
        );
  const wagesCents = payrollRuns.reduce((sum, run) => sum + run.wagesCents, 0);
  const employerTaxCents = payrollRuns.reduce(
    (sum, run) => sum + run.employerTaxCents,
    0,
  );
  const loadedLaborCents = payrollRuns.reduce(
    (sum, run) => sum + run.loadedLaborCents,
    0,
  );

  const costingApplies =
    period.startsOn === currentPeriod.startsOn &&
    period.endsOn === currentPeriod.endsOn;
  const cogsReady = costingApplies && costing.postingValueCents !== null;
  const cogsCents =
    cogsReady && costing.postingValueCents
      ? costing.postingValueCents.cogs + costing.postingValueCents.waste
      : null;
  const wasteCents = cogsReady
    ? (costing.postingValueCents?.waste ?? null)
    : null;
  const prime = primeCostCents(cogsCents ?? 0, loadedLaborCents);
  const lines: ProfitCostLine[] = [
    {
      key: "cogs",
      label: "Cost of goods (including waste)",
      cents: cogsCents ?? 0,
      complete: Boolean(cogsReady),
    },
    {
      key: "labor",
      label: "Loaded labor (wages + employer tax)",
      cents: loadedLaborCents,
      complete: true,
    },
    {
      key: "occupancy",
      label: "Occupancy (rent, utilities, CAM)",
      cents: 0,
      complete: false,
    },
  ];

  return {
    status: "ready" as const,
    period,
    periodNote,
    netSalesCents,
    taxCents,
    tipCents,
    salesDays: uniqueDays.length,
    cogsCents,
    wasteCents,
    loadedLaborCents,
    wagesCents,
    employerTaxCents,
    payrollRuns,
    primeCostCents: prime,
    contributionCents: contributionAfterPrimeCents(netSalesCents, prime),
    lines,
    largestCost: largestCostLine(lines),
    ratios: {
      cogs: cogsCents === null ? null : salesRatio(cogsCents, netSalesCents),
      labor: salesRatio(loadedLaborCents, netSalesCents),
      prime: cogsCents === null ? null : salesRatio(prime, netSalesCents),
    },
    benchmarks: PRIME_COST_BENCHMARKS,
    costingStatus: costingApplies ? costing.status : "awaiting_period",
  };
}
