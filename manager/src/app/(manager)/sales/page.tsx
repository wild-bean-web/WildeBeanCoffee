import {
  BadgeDollarSign,
  CircleCheckBig,
  CreditCard,
  RefreshCcw,
  Store,
} from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { CloverSalesImport } from "@/components/clover-sales-import";
import { PageHeader } from "@/components/page-header";
import { SalesExpenseGraph } from "@/components/sales-expense-graph";
import { StatusPill } from "@/components/status-pill";
import { dailyFlows } from "@/domain/sales-expense-series";
import { hasCapability } from "@/lib/auth/capabilities";
import { requireCapability } from "@/lib/auth/session";
import { parseDateRangeParams, todayIso } from "@/lib/date-range";
import { formatMoney, formatShortDate } from "@/lib/format";
import { loadStatementExpenses } from "@/services/expenses/ledger";
import { listDailySalesControlsForRange } from "@/services/sales/queries";
import { getLocationSetup } from "@/services/locations/setup";
import { activeLocationName } from "@/services/locations/scope";

const channels = [
  {
    name: "Clover in-store",
    detail: "Orders, line items, modifiers, tenders, tips, and refunds",
    mode: "Webhook + nightly",
  },
  {
    name: "Wild Bean website",
    detail: "Sanitized order details correlated to Clover payment IDs",
    mode: "Durable outbox",
  },
  {
    name: "DoorDash",
    detail: "Order detail, fees, adjustments, and payout reports",
    mode: "API or CSV",
  },
  {
    name: "Uber Eats",
    detail: "Provisional orders followed by settled reporting data",
    mode: "API or CSV",
  },
] as const;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireCapability("dashboard:view");
  const range = parseDateRangeParams(await searchParams);
  const allControls = await listDailySalesControlsForRange(session);
  const controls = range
    ? allControls.filter(
        (row) => row.businessDate >= range.startsOn && row.businessDate <= range.endsOn,
      )
    : allControls;
  const uniqueDays = new Map<string, (typeof controls)[number]>();
  for (const row of controls) {
    const current = uniqueDays.get(row.businessDate);
    if (!current) {
      uniqueDays.set(row.businessDate, row);
      continue;
    }
    const currentClover = /clover/i.test(current.sourceSystem);
    const nextClover = /clover/i.test(row.sourceSystem);
    if (nextClover && !currentClover) uniqueDays.set(row.businessDate, row);
  }
  const days = [...uniqueDays.values()];
  const latest = days[0];
  const netCollected = days.reduce((sum, row) => sum + row.netCollectedCents, 0);
  const orderCount = days.reduce((sum, row) => sum + row.orderCount, 0);
  const setup = await getLocationSetup(session);
  const configured = setup.clover.configured;
  const locationName = activeLocationName(session);
  const canViewExpenses = hasCapability(session.role, "bank:view");
  const graphDays = canViewExpenses
    ? dailyFlows({
        today: todayIso(),
        sales: allControls.map((row) => ({
          businessDate: row.businessDate,
          sourceSystem: row.sourceSystem,
          grossCents: row.grossCents,
          discountCents: row.discountCents,
          refundCents: row.refundCents,
          taxCents: row.taxCents,
          tipCents: row.tipCents,
          netCollectedCents: row.netCollectedCents,
        })),
        expenses: loadStatementExpenses(null, "all").entries.map((entry) => ({
          isoDate: entry.isoDate,
          amountCents: entry.amountCents,
        })),
      })
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Sales controls"
        title="Daily sales reconciliation"
        description={
          locationName
            ? `Clover and website sales for ${locationName} only. Other locations reconcile on their own books.`
            : "Real-time activity remains provisional. A day becomes verified only after order, tender, refund, tax, tip, and payment controls agree."
        }
        actions={
          <>
            {canViewExpenses ? (
              <SalesExpenseGraph days={graphDays} today={todayIso()} />
            ) : null}
            <CloverSalesImport
              from={range?.startsOn ?? ""}
              to={range?.endsOn ?? ""}
              configured={configured}
            />
          </>
        }
      />

      <DateRangeFilter
        from={range?.startsOn ?? ""}
        to={range?.endsOn ?? ""}
        allowAll
      />

      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-label">
            <span>Net collected</span>
            <BadgeDollarSign className="metric-icon" size={18} />
          </div>
          <p className="metric-value">
            {days.length > 0 ? formatMoney(netCollected) : "—"}
          </p>
          <p className="metric-note">
            {days.length > 0
              ? `${days.length} sales day${days.length === 1 ? "" : "s"} in range`
              : "No sales in this range"}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Order count</span>
            <Store className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{days.length > 0 ? orderCount : "—"}</p>
          <p className="metric-note">All channels</p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Expected payout</span>
            <CreditCard className="metric-icon" size={18} />
          </div>
          <p className="metric-value">—</p>
          <p className="metric-note">Clearing accounts</p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Control status</span>
            <CircleCheckBig className="metric-icon" size={18} />
          </div>
          <p className="metric-value">
            {latest?.status === "verified"
              ? "Verified"
              : configured
                ? "Ready"
                : "Setup"}
          </p>
          <p className="metric-note">
            {configured ? "Clover credentials found" : "No live credentials"}
          </p>
        </article>
      </section>

      {controls.length > 0 ? (
        <section className="panel mb-5">
          <div className="panel-header">
            <div>
              <h2>Clover controls</h2>
              <p>
                {range
                  ? `${formatShortDate(range.startsOn)} – ${formatShortDate(range.endsOn)}`
                  : "All dates"}
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Business date</th>
                  <th className="numeric">Orders</th>
                  <th className="numeric">Gross</th>
                  <th className="numeric">Refunds</th>
                  <th className="numeric">Net collected</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {controls.map((control) => (
                  <tr key={control.id}>
                    <td>{formatShortDate(control.businessDate)}</td>
                    <td className="numeric">{control.orderCount}</td>
                    <td className="numeric">
                      {formatMoney(control.grossCents)}
                    </td>
                    <td className="numeric">
                      {formatMoney(control.refundCents)}
                    </td>
                    <td className="numeric">
                      {formatMoney(control.netCollectedCents)}
                    </td>
                    <td>
                      <StatusPill
                        tone={
                          control.status === "verified"
                            ? "success"
                            : "danger"
                        }
                      >
                        {control.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Sales channels</h2>
            <p>Each source keeps separate authority and clearing controls.</p>
          </div>
          <StatusPill tone={configured ? "success" : "warning"}>
            {configured ? "Clover ready" : "Connections pending"}
          </StatusPill>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Captured facts</th>
                <th>Import mode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel, index) => (
                <tr key={channel.name}>
                  <td className="font-semibold">{channel.name}</td>
                  <td>{channel.detail}</td>
                  <td>{channel.mode}</td>
                  <td>
                    <StatusPill
                      tone={index === 0 && configured ? "success" : "neutral"}
                    >
                      {index === 0 && configured ? "Configured" : "Not connected"}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-body">
          <div className="callout">
            <RefreshCcw size={18} />
            <span>
              Import the selected date range from Clover using this store's
              merchant token. Webhooks can speed up later days; this pull is
              what fills Sales and Prime cost.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
