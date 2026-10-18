import Link from "next/link";
import { DateRangeFilter } from "@/components/date-range-filter";
import { MoneyDonut } from "@/components/money-donut";
import { PageHeader } from "@/components/page-header";
import { hasCapability } from "@/lib/auth/capabilities";
import { requireCapability } from "@/lib/auth/session";
import { parseDateRangeParams, todayIso } from "@/lib/date-range";
import { formatMoney, formatPercent, formatShortDate } from "@/lib/format";
import { chooseLaborCost } from "@/domain/labor-sales";
import { presentedLeftover } from "@/domain/statement-pnl";
import { activeLocationName } from "@/services/locations/scope";
import { loadStatementExpenses } from "@/services/expenses/ledger";
import { listPostedPayrollForPeriod } from "@/services/payroll/runs";
import { getBookExceptions } from "@/services/profit/exceptions";
import { getStatementPnl } from "@/services/profit/statement";

function toneClass(cents: number): string {
  return cents < 0 ? "money-negative" : "money-positive";
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireCapability("dashboard:view");
  const range = parseDateRangeParams(await searchParams);
  const today = todayIso();
  const bounds = range ?? { startsOn: "2020-01-01", endsOn: today };
  const locationName = activeLocationName(session);
  const canBank = hasCapability(session.role, "bank:view");
  const canLabor = hasCapability(session.role, "payroll:view");
  const pnl = await getStatementPnl(session, range);
  const posted = canLabor
    ? await listPostedPayrollForPeriod(session, bounds.startsOn, bounds.endsOn, "overlap")
    : [];
  const expenses = canLabor
    ? await loadStatementExpenses(session.organizationId, range, "operating")
    : null;
  const laborChoice = chooseLaborCost({
    posted: posted.flatMap((run) =>
      run.periodStartsOn && run.periodEndsOn
        ? [{
            startsOn: run.periodStartsOn,
            endsOn: run.periodEndsOn,
            loadedLaborCents: run.loadedLaborCents,
          }]
        : [],
    ),
    statementPayroll:
      expenses?.entries
        .filter((entry) => /payroll/i.test(entry.category))
        .map((entry) => ({ isoDate: entry.isoDate, amountCents: entry.amountCents })) ?? [],
  });
  const laborDays = laborChoice.days.filter(
    (day) => day.isoDate >= bounds.startsOn && day.isoDate <= bounds.endsOn,
  );
  const labor =
    laborChoice.source === "posted" && laborDays.every((day) => day.amountCents === 0)
      ? chooseLaborCost({
          posted: [],
          statementPayroll:
            expenses?.entries
              .filter((entry) => /payroll/i.test(entry.category))
              .map((entry) => ({ isoDate: entry.isoDate, amountCents: entry.amountCents })) ?? [],
        })
      : { ...laborChoice, days: laborDays, totalCents: laborDays.reduce((sum, day) => sum + day.amountCents, 0) };
  const laborShare = pnl.salesCents > 0 ? labor.totalCents / pnl.salesCents : null;
  const books = presentedLeftover(pnl);
  const exceptions = await getBookExceptions(session);
  const leftoverNote =
    books.limitedToBooks && pnl.booksThrough
      ? `Through ${formatShortDate(pnl.booksThrough)}. ${formatMoney(pnl.salesOutsideBooksCents)} of later sales are not included.`
      : books.leftoverCents === null
        ? "No bank lines in these dates, so leftover is not shown."
        : "Sales minus cafe operating";
  const visibleExceptions = exceptions.filter((item) => {
    if (item.id === "bank-gap" || item.id === "unnamed") return canBank;
    if (item.id === "payroll") return canLabor;
    return true;
  });
  const slices = [
    { label: "Cafe operating", cents: pnl.operatingCents, color: "#5a3d2a" },
    { label: "Personal", cents: pnl.personalCents, color: "#347ba5" },
    { label: "Cash taken", cents: pnl.cashCents, color: "#9b681c" },
    { label: "Unnamed", cents: pnl.otherCents, color: "#a4473b" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Store performance"
        title={locationName ? locationName : "This store"}
        description="Product sales from the register, next to the money that left the bank. Tips and sales tax are not profit. Personal charges and cash taken are not treated as the store losing money."
      />

      <DateRangeFilter from={range?.startsOn ?? ""} to={range?.endsOn ?? ""} allowAll />

      <section className="metrics-grid" aria-label="Store performance">
        <article className="metric-card">
          <div className="metric-label"><span>Sales</span></div>
          <p className="metric-value">{formatMoney(pnl.salesCents)}</p>
          <p className="metric-note">
            {pnl.salesDays > 0 ? `${pnl.salesDays} register days` : "No register sales in these dates"}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label"><span>Cafe operating</span></div>
          <p className="metric-value">{canBank ? formatMoney(pnl.operatingCents) : "—"}</p>
          <p className="metric-note">Rent, food, payroll, utilities</p>
        </article>
        <article className="metric-card metric-card-total">
          <div className="metric-label"><span>Store leftover</span></div>
          <p className={`metric-value ${canBank && books.leftoverCents !== null ? toneClass(books.leftoverCents) : ""}`}>
            {canBank && books.leftoverCents !== null ? formatMoney(books.leftoverCents) : "—"}
          </p>
          <p className="metric-note">{canBank ? leftoverNote : "Sales minus cafe operating"}</p>
        </article>
        <article className="metric-card">
          <div className="metric-label"><span>After everything</span></div>
          <p className={`metric-value ${canBank && books.afterAllCents !== null ? toneClass(books.afterAllCents) : ""}`}>
            {canBank && books.afterAllCents !== null ? formatMoney(books.afterAllCents) : "—"}
          </p>
          <p className="metric-note">Sales minus every recorded outflow</p>
        </article>
      </section>

      {visibleExceptions.length > 0 ? (
        <section className="panel" aria-label="Needs attention">
          <div className="panel-header">
            <div>
              <h2>Needs attention</h2>
              <p>These are the gaps between this store and a book you can trust.</p>
            </div>
          </div>
          <ul className="exception-list">
            {visibleExceptions.map((item) => (
              <li key={item.id}>
                <Link href={item.href}>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="content-grid content-grid-main">
        {canBank && books.leftoverCents !== null ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Where the money went</h2>
                <p>
                  The ring is money that left the account. The center is what the store had left after cafe operating costs.
                </p>
              </div>
              <Link href="/pnl" className="button">
                Open P&amp;L
              </Link>
            </div>
            <MoneyDonut
              slices={slices}
              centerLabel="Store leftover"
              centerCents={books.leftoverCents ?? 0}
            />
          </section>
        ) : null}

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Labor against sales</h2>
              <p>
                {labor.source === "posted"
                  ? "Posted payroll for these dates, compared with register sales."
                  : labor.source === "statements"
                    ? "Payroll from the bank statements, because no payroll preview is posted yet. It is not added on top of the operating total."
                    : "No payroll is recorded for these dates."}
              </p>
            </div>
            {canLabor ? (
              <Link href="/labor" className="button">
                Open labor
              </Link>
            ) : null}
          </div>
          <div className="metrics-grid money-inline-metrics">
            <article className="metric-card">
              <div className="metric-label"><span>Labor</span></div>
              <p className="metric-value">{formatMoney(labor.totalCents)}</p>
              <p className="metric-note">
                {laborShare === null ? "Needs sales to show a share" : `${formatPercent(laborShare)} of sales`}
              </p>
            </article>
            <article className="metric-card">
              <div className="metric-label"><span>Sales minus labor</span></div>
              <p className={`metric-value ${toneClass(pnl.salesCents - labor.totalCents)}`}>
                {formatMoney(pnl.salesCents - labor.totalCents)}
              </p>
              <p className="metric-note">
                {pnl.salesCents - labor.totalCents >= 0
                  ? "Sales covered labor"
                  : "Labor was higher than sales"}
              </p>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}
