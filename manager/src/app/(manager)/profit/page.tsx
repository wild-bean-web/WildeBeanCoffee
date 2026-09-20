import { CircleAlert, Scale, TrendingDown, Wallet } from "lucide-react";
import Link from "next/link";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCapability } from "@/lib/auth/session";
import { parseDateRangeParams } from "@/lib/date-range";
import { formatMoney, formatPercent, formatShortDate } from "@/lib/format";
import { activeLocationName } from "@/services/locations/scope";
import { getLocationPnl } from "@/services/profit/location";

export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireCapability("profit:view");
  const requested = parseDateRangeParams(await searchParams);
  const pnl = await getLocationPnl(session, requested ?? undefined);
  const locationName = activeLocationName(session);
  const periodLabel = pnl.period
    ? `${pnl.period.name} · ${formatShortDate(pnl.period.startsOn)} – ${formatShortDate(pnl.period.endsOn)}`
    : "Open an accounting period to build this statement";
  const filterFrom = requested?.startsOn ?? pnl.period?.startsOn ?? "";
  const filterTo = requested?.endsOn ?? pnl.period?.endsOn ?? "";

  return (
    <>
      <PageHeader
        eyebrow="Location P&L"
        title="Prime cost"
        description={
          locationName
            ? `True store profit for ${locationName}: net sales minus cost of goods and loaded labor. Occupancy and other operating expenses join this statement as those costs are captured.`
            : "Restaurant prime cost is cost of goods plus loaded labor, shown as a share of net sales. That is the operating picture that shows which cost is hurting the location."
        }
      />

      {filterFrom && filterTo ? (
        <DateRangeFilter from={filterFrom} to={filterTo} />
      ) : null}

      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-label">
            <span>Net sales</span>
            <Wallet className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{formatMoney(pnl.netSalesCents)}</p>
          <p className="metric-note">
            {pnl.salesDays > 0
              ? `${pnl.salesDays} sales day${pnl.salesDays === 1 ? "" : "s"} · tips ${formatMoney(pnl.tipCents)} pass through`
              : "No Clover sales days in this period yet"}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Prime cost</span>
            <Scale className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{formatMoney(pnl.primeCostCents)}</p>
          <p className="metric-note">
            {formatPercent(pnl.ratios.prime)} of sales · target under{" "}
            {formatPercent(pnl.benchmarks.primeCostShare)}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>After prime cost</span>
            <TrendingDown className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{formatMoney(pnl.contributionCents)}</p>
          <p className="metric-note">
            Left to cover occupancy, operating expenses, and profit
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Biggest captured cost</span>
            <CircleAlert className="metric-icon" size={18} />
          </div>
          <p className="metric-value">
            {pnl.largestCost ? formatMoney(pnl.largestCost.cents) : "—"}
          </p>
          <p className="metric-note">
            {pnl.largestCost?.label ?? "Post payroll and inventory counts to compare"}
          </p>
        </article>
      </section>

      <div className="content-grid content-grid-main mt-5">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Period statement</h2>
              <p>{periodLabel}</p>
            </div>
            <StatusPill tone={pnl.status === "ready" ? "info" : "warning"}>
              {pnl.status === "ready" ? "operational P&L" : "awaiting period"}
            </StatusPill>
          </div>
          {pnl.periodNote ? (
            <p className="px-4 pb-3 text-sm text-muted">{pnl.periodNote}</p>
          ) : null}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th className="numeric">Amount</th>
                  <th className="numeric">% of sales</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Net sales</td>
                  <td className="numeric">{formatMoney(pnl.netSalesCents)}</td>
                  <td className="numeric">
                    {pnl.netSalesCents > 0 ? "100.0%" : "—"}
                  </td>
                  <td>
                    {pnl.salesDays > 0 ? "From daily sales controls" : "No sales yet"}
                  </td>
                </tr>
                <tr>
                  <td>Cost of goods (including waste)</td>
                  <td className="numeric">
                    {pnl.cogsCents === null ? "—" : formatMoney(pnl.cogsCents)}
                  </td>
                  <td className="numeric">{formatPercent(pnl.ratios.cogs)}</td>
                  <td>
                    {pnl.cogsCents === null
                      ? `Inventory ${pnl.costingStatus.replaceAll("_", " ")}`
                      : pnl.wasteCents
                        ? `Includes ${formatMoney(pnl.wasteCents)} waste`
                        : "From posted counts"}
                  </td>
                </tr>
                <tr>
                  <td>Loaded labor</td>
                  <td className="numeric">{formatMoney(pnl.loadedLaborCents)}</td>
                  <td className="numeric">{formatPercent(pnl.ratios.labor)}</td>
                  <td>
                    {pnl.payrollRuns.length > 0
                      ? `${pnl.payrollRuns.length} posted payroll run${pnl.payrollRuns.length === 1 ? "" : "s"}`
                      : "Upload and post a payroll preview"}
                  </td>
                </tr>
                <tr>
                  <td>Prime cost</td>
                  <td className="numeric">{formatMoney(pnl.primeCostCents)}</td>
                  <td className="numeric">{formatPercent(pnl.ratios.prime)}</td>
                  <td>
                    COGS + labor · typical restaurant target under{" "}
                    {formatPercent(pnl.benchmarks.primeCostShare)}
                  </td>
                </tr>
                <tr>
                  <td>Occupancy</td>
                  <td className="numeric">—</td>
                  <td className="numeric">—</td>
                  <td>Rent, utilities, and CAM are not captured yet</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th>Contribution after prime cost</th>
                  <th className="numeric">{formatMoney(pnl.contributionCents)}</th>
                  <th className="numeric">
                    {formatPercent(
                      pnl.netSalesCents > 0
                        ? pnl.contributionCents / pnl.netSalesCents
                        : null,
                    )}
                  </th>
                  <th>Before occupancy and other operating expenses</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <aside className="content-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Where to look first</h2>
                <p>
                  This is a location P&L built on restaurant prime cost (USAR).
                  The largest complete line is the first place to improve.
                </p>
              </div>
            </div>
            <ul className="list">
              <li className="list-row">
                <div className="list-copy">
                  <p className="list-title">Labor vs sales</p>
                  <p className="list-meta">
                    Loaded labor {formatPercent(pnl.ratios.labor)} of sales.
                    Labor often lands near {formatPercent(pnl.benchmarks.laborShare)}.
                    Overtime and extra coverage show up here before rent does.
                  </p>
                </div>
              </li>
              <li className="list-row">
                <div className="list-copy">
                  <p className="list-title">Food and packaging cost</p>
                  <p className="list-meta">
                    COGS {formatPercent(pnl.ratios.cogs)} of sales, including
                    waste. Counts and posted invoices have to exist before this
                    number is real.
                  </p>
                </div>
              </li>
              <li className="list-row">
                <div className="list-copy">
                  <p className="list-title">Still missing</p>
                  <p className="list-meta">
                    Occupancy, delivery commissions, and other operating
                    expenses are the next cost families. They will slot under
                    contribution after prime cost.
                  </p>
                </div>
              </li>
            </ul>
          </section>
          <section className="callout">
            <span>
              Tips of {formatMoney(pnl.tipCents)} and sales tax of{" "}
              {formatMoney(pnl.taxCents)} are shown as pass-throughs, not store
              profit or store cost.{" "}
              <Link href="/labor">Post payroll</Link> and keep inventory counts
              current so this statement stays complete.
            </span>
          </section>
        </aside>
      </div>
    </>
  );
}
