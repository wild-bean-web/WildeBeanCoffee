import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CircleHelp,
  Landmark,
  PieChart,
  Wallet,
} from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { ExpenseBreakdown } from "@/components/expense-breakdown";
import { ExpenseCategoryFilter } from "@/components/expense-category-filter";
import { PageHeader } from "@/components/page-header";
import { requireCapability } from "@/lib/auth/session";
import { parseDateRangeParams } from "@/lib/date-range";
import {
  categoryNames,
  expenseGroupLabels,
  expenseGroups,
  expenseSearchParams,
  filterExpensesByCategory,
  isExpenseGroup,
  type ExpenseGroup,
} from "@/domain/expenses/ledger";
import { formatMoney, formatShortDate } from "@/lib/format";
import { activeLocationName } from "@/services/locations/scope";
import { loadStatementExpenses } from "@/services/expenses/ledger";

function expenseHref(
  group: ExpenseGroup | "all",
  from: string,
  to: string,
  category?: string,
): string {
  const query = expenseSearchParams({ from, to, group, category });
  return query ? `/expenses?${query}` : "/expenses";
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    group?: string;
    category?: string;
  }>;
}) {
  const session = await requireCapability("bank:view");
  const params = await searchParams;
  const range = parseDateRangeParams(params);
  const requestedGroup = Array.isArray(params.group) ? params.group[0] : params.group;
  const group: ExpenseGroup | "all" = isExpenseGroup(requestedGroup ?? "")
    ? requestedGroup
    : "all";
  const from = range?.startsOn ?? "";
  const to = range?.endsOn ?? "";
  const totals = loadStatementExpenses(range, "all");
  const summary = group === "all" ? totals : loadStatementExpenses(range, group);
  const categories = categoryNames(summary);
  const requestedCategory = (
    Array.isArray(params.category) ? params.category[0] : params.category
  )?.trim() ?? "";
  if (requestedCategory && !categories.includes(requestedCategory)) {
    redirect(expenseHref(group, from, to));
  }
  const category = requestedCategory || "";
  const lines = category ? filterExpensesByCategory(summary, category) : summary;
  const locationName = activeLocationName(session);
  const reportQuery = expenseSearchParams({
    from,
    to,
    group,
    category: category || undefined,
  });
  const operating =
    totals.byGroup.find((row) => row.group === "operating")?.amountCents ?? 0;
  const personal =
    totals.byGroup.find((row) => row.group === "personal")?.amountCents ?? 0;
  const cash = totals.byGroup.find((row) => row.group === "cash")?.amountCents ?? 0;
  const other = totals.byGroup
    .filter((row) => row.group === "unknown" || row.group === "unassigned")
    .reduce((sum, row) => sum + row.amountCents, 0);

  return (
    <>
      <PageHeader
        eyebrow="Business checking"
        title="Expenses"
        description={
          locationName
            ? `Statement lines for ${locationName}, dated when they posted. Cafe operating costs are the store expenses. Personal charges, cash withdrawals, and unnamed purchases stay in their own totals. Loan draws and loan payments are not on this page.`
            : "Statement lines dated when they posted. Cafe operating costs are the store expenses. Loan draws and loan payments are not on this page."
        }
      />

      <DateRangeFilter
        from={from}
        to={to}
        allowAll
        preserve={{
          group: group === "all" ? undefined : group,
          category: category || undefined,
        }}
      />

      <div className="date-range-presets expense-group-filter" role="group" aria-label="Expense type">
        <Link
          href={expenseHref("all", from, to, category)}
          className={`date-range-preset${group === "all" ? " date-range-preset-active" : ""}`}
        >
          All expenses
        </Link>
        {expenseGroups.map((key) => (
          <Link
            key={key}
            href={expenseHref(key, from, to, category)}
            className={`date-range-preset${group === key ? " date-range-preset-active" : ""}`}
          >
            {expenseGroupLabels[key]}
          </Link>
        ))}
      </div>

      <section className="metrics-grid">
        <article className="metric-card metric-card-total">
          <div className="metric-label">
            <span>Total expenses</span>
          </div>
          <p className="metric-value">{formatMoney(totals.totalCents)}</p>
          <p className="metric-note">
            Cafe operating, personal charges, cash withdrawals, and unnamed items for these dates
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Cafe operating</span>
            <Landmark className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{formatMoney(operating)}</p>
          <p className="metric-note">Rent, food, payroll, utilities, and other store costs</p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Personal, paid by the business</span>
            <Wallet className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{formatMoney(personal)}</p>
          <p className="metric-note">Owner charges that stayed on the business account</p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>ATM/counter withdrawals</span>
            <PieChart className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{formatMoney(cash)}</p>
          <p className="metric-note">Cash taken out of the business account</p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Unknown or needs a payee</span>
            <CircleHelp className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{formatMoney(other)}</p>
          <p className="metric-note">Unnamed card purchases and checks without a payee</p>
        </article>
      </section>

      <ExpenseBreakdown
        totalCents={summary.totalCents}
        categories={summary.byCategory
          .filter((row) => row.amountCents > 0)
          .map((row) => ({
            category: row.category,
            groupLabel: expenseGroupLabels[row.group],
            amountCents: row.amountCents,
          }))}
      />

      <section className="panel mt-5">
        <div className="panel-header expense-lines-header">
          <div>
            <h2>By date</h2>
            <p>
              {lines.entries.length > 0
                ? `${formatMoney(lines.totalCents)} across ${lines.entries.length} posted line${lines.entries.length === 1 ? "" : "s"}`
                : category
                  ? "No posted lines for this category"
                  : "No posted lines in this date range"}
            </p>
          </div>
          <div className="expense-line-tools">
            <ExpenseCategoryFilter
              categories={categories}
              value={category}
              from={from}
              to={to}
              group={group}
            />
            <a
              className="button"
              href={reportQuery ? `/expenses/report?${reportQuery}` : "/expenses/report"}
              target="_blank"
              rel="noreferrer"
            >
              Export PDF
            </a>
          </div>
        </div>
        <div className="table-wrap expense-lines">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>What posted</th>
                <th>Category</th>
                <th className="numeric">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.entries.length === 0 ? (
                <tr>
                  <td colSpan={4}>No expenses in this date range.</td>
                </tr>
              ) : (
                lines.entries.map((entry, index) => (
                  <tr key={`${entry.isoDate}-${entry.category}-${entry.description}-${index}`}>
                    <td>{formatShortDate(entry.isoDate)}</td>
                    <td>{entry.description}</td>
                    <td>
                      {entry.category}
                      <span className="expense-line-group">{expenseGroupLabels[entry.group]}</span>
                    </td>
                    <td className="numeric">{formatMoney(entry.amountCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
