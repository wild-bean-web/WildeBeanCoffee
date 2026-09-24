import { Scale } from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { salesGap } from "@/domain/statement-pnl";
import { requireCapability } from "@/lib/auth/session";
import { parseDateRangeParams } from "@/lib/date-range";
import { formatMoney, formatShortDate } from "@/lib/format";
import { activeLocationName } from "@/services/locations/scope";
import { getStatementPnl } from "@/services/profit/statement";

function moneyTone(cents: number): "success" | "danger" | "neutral" {
  if (cents > 0) return "success";
  if (cents < 0) return "danger";
  return "neutral";
}

function resultLabel(cents: number): string {
  if (cents > 0) return "Positive";
  if (cents < 0) return "Negative";
  return "Even";
}

export default async function StatementPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireCapability("profit:view");
  const range = parseDateRangeParams(await searchParams);
  const pnl = await getStatementPnl(session, range);
  const locationName = activeLocationName(session);
  const gap = salesGap(pnl);
  const gapText =
    gap === "missing"
      ? "No Clover sales are recorded for these dates. Leftover treats sales as $0."
      : gap === "partial" && pnl.salesFirst && pnl.salesLast && pnl.expenseFirst && pnl.expenseLast
        ? `Clover sales are recorded from ${formatShortDate(pnl.salesFirst)} through ${formatShortDate(pnl.salesLast)} (${pnl.salesDays} days). Expenses in this view run ${formatShortDate(pnl.expenseFirst)} through ${formatShortDate(pnl.expenseLast)}. Leftover uses only the sales that are imported.`
        : null;
  const from = range?.startsOn ?? "";
  const to = range?.endsOn ?? "";

  return (
    <>
      <PageHeader
        eyebrow="True P&L"
        title="Profit and loss"
        description={
          locationName
            ? `Sales for ${locationName} are Clover product sales. Tips and sales tax are not profit. Store leftover is those sales minus cafe operating expenses from the bank statements. Personal charges, cash withdrawals, and unnamed items are shown under that, because they left the account but are not store costs.`
            : "Sales are Clover product sales. Store leftover is those sales minus cafe operating expenses."
        }
      />

      <DateRangeFilter from={from} to={to} allowAll />

      {gapText ? <p className="pnl-gap">{gapText}</p> : null}

      <section className="metrics-grid pnl-metrics">
        <article className="metric-card">
          <div className="metric-label">
            <span>Sales</span>
            <Scale className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{formatMoney(pnl.salesCents)}</p>
          <p className="metric-note">
            {pnl.salesDays > 0
              ? `${pnl.salesDays} Clover day${pnl.salesDays === 1 ? "" : "s"} · tips ${formatMoney(pnl.tipCents)} and tax ${formatMoney(pnl.taxCents)} excluded`
              : "No Clover sales in these dates"}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Cafe operating expenses</span>
          </div>
          <p className="metric-value">{formatMoney(pnl.operatingCents)}</p>
          <p className="metric-note">Rent, food, payroll, utilities, and other store costs</p>
        </article>
        <article className="metric-card metric-card-total">
          <div className="metric-label">
            <span>Store leftover</span>
            <StatusPill tone={moneyTone(pnl.storeLeftoverCents)}>
              {resultLabel(pnl.storeLeftoverCents)}
            </StatusPill>
          </div>
          <p className="metric-value">{formatMoney(pnl.storeLeftoverCents)}</p>
          <p className="metric-note">Sales minus cafe operating expenses</p>
        </article>
        <article className="metric-card metric-card-total">
          <div className="metric-label">
            <span>Left after all recorded outflows</span>
            <StatusPill tone={moneyTone(pnl.afterAllOutflowsCents)}>
              {resultLabel(pnl.afterAllOutflowsCents)}
            </StatusPill>
          </div>
          <p className="metric-value">{formatMoney(pnl.afterAllOutflowsCents)}</p>
          <p className="metric-note">
            Sales minus every recorded expense, including personal charges, cash withdrawals, and unnamed items
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Statement</h2>
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
                <th>Line</th>
                <th className="numeric">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sales</td>
                <td className="numeric">{formatMoney(pnl.salesCents)}</td>
              </tr>
              <tr>
                <td>Cafe operating expenses</td>
                <td className="numeric">{formatMoney(pnl.operatingCents)}</td>
              </tr>
              <tr className="group-subtotal">
                <th>Store leftover</th>
                <td className="numeric">{formatMoney(pnl.storeLeftoverCents)}</td>
              </tr>
              <tr>
                <td>Personal, paid by the business</td>
                <td className="numeric">{formatMoney(pnl.personalCents)}</td>
              </tr>
              <tr>
                <td>ATM/counter withdrawals</td>
                <td className="numeric">{formatMoney(pnl.cashCents)}</td>
              </tr>
              <tr>
                <td>Unknown or needs a payee</td>
                <td className="numeric">{formatMoney(pnl.otherCents)}</td>
              </tr>
              <tr className="group-subtotal">
                <th>Left after all recorded outflows</th>
                <td className="numeric">{formatMoney(pnl.afterAllOutflowsCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {pnl.operatingCategories.length > 0 ? (
        <section className="panel mt-5">
          <div className="panel-header">
            <div>
              <h2>Cafe operating expenses</h2>
              <p>Same categories as the Expenses page, for these dates</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="numeric">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pnl.operatingCategories.map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td className="numeric">{formatMoney(row.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
