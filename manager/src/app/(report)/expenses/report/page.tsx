import type { Metadata } from "next";
import { ExpenseReportPrint } from "@/components/expense-report-print";
import { requireCapability } from "@/lib/auth/session";
import { parseDateRangeParams, todayIso } from "@/lib/date-range";
import {
  categoryNames,
  expenseGroupLabels,
  expenseSearchParams,
  filterExpensesByCategory,
  isExpenseGroup,
  quarterlyExpenseTotals,
  type ExpenseGroup,
  type ExpenseSummary,
} from "@/domain/expenses/ledger";
import { formatMoney, formatPercent, formatShortDate } from "@/lib/format";
import { activeLocationName } from "@/services/locations/scope";
import { loadStatementExpenses } from "@/services/expenses/ledger";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function viewFor(
  range: { startsOn: string; endsOn: string } | null,
  group: ExpenseGroup | "all",
  category: string,
): { summary: ExpenseSummary; categoryLabel: string } {
  const parent = loadStatementExpenses(range, group);
  const available = categoryNames(parent);
  if (category && available.includes(category)) {
    return {
      summary: filterExpensesByCategory(parent, category),
      categoryLabel: category,
    };
  }
  return { summary: parent, categoryLabel: "All categories" };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}): Promise<Metadata> {
  const range = parseDateRangeParams(await searchParams);
  const period = range ? `${range.startsOn} to ${range.endsOn}` : "all dates";
  return { title: `Wild Bean expense report ${period}` };
}

export default async function ExpenseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; group?: string; category?: string }>;
}) {
  const session = await requireCapability("bank:view");
  const params = await searchParams;
  const range = parseDateRangeParams(params);
  const requestedGroup = first(params.group);
  const group: ExpenseGroup | "all" = isExpenseGroup(requestedGroup)
    ? requestedGroup
    : "all";
  const { summary, categoryLabel } = viewFor(range, group, first(params.category));
  const locationName = activeLocationName(session) ?? "Wild Bean Coffee";
  const quarters = quarterlyExpenseTotals(summary.entries);
  const period = range
    ? `${formatShortDate(range.startsOn)} – ${formatShortDate(range.endsOn)}`
    : "All statement dates on file";
  const groupLabel = group === "all" ? "All expense types" : expenseGroupLabels[group];
  const backQuery = expenseSearchParams({
    from: range?.startsOn,
    to: range?.endsOn,
    group,
    category: categoryLabel === "All categories" ? undefined : categoryLabel,
  });

  return (
    <main className="expense-report">
      <div className="expense-report-toolbar">
        <a className="button" href={backQuery ? `/expenses?${backQuery}` : "/expenses"}>
          Back to expenses
        </a>
        <ExpenseReportPrint />
      </div>

      <header className="expense-report-heading">
        <p>Wild Bean Coffee</p>
        <h1>Expense report</h1>
        <p>{locationName}</p>
      </header>

      <section className="expense-report-summary">
        <h2>Summary</h2>
        <dl>
          <div>
            <dt>Period</dt>
            <dd>{period}</dd>
          </div>
          <div>
            <dt>Expense type</dt>
            <dd>{groupLabel}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{categoryLabel}</dd>
          </div>
          <div>
            <dt>Prepared</dt>
            <dd>{formatShortDate(todayIso())}</dd>
          </div>
          <div>
            <dt>Posted lines</dt>
            <dd>{summary.entries.length}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatMoney(summary.totalCents)}</dd>
          </div>
        </dl>
        <p>
          Amounts are what posted to the business checking account. A negative
          amount is a refund or return. Loan draws and loan payments are excluded.
          Cafe operating is the store cost. Personal charges, cash withdrawals, and
          unnamed items are separate and are included only when this report&apos;s
          filters select them.
        </p>
      </section>

      <section>
        <h2>By expense type</h2>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {summary.byGroup
              .filter((row) => row.amountCents !== 0)
              .map((row) => (
                <tr key={row.group}>
                  <td>{expenseGroupLabels[row.group]}</td>
                  <td>{formatMoney(row.amountCents)}</td>
                </tr>
              ))}
            <tr>
              <th>Total</th>
              <th>{formatMoney(summary.totalCents)}</th>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>By category</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {summary.byCategory.length === 0 ? (
              <tr>
                <td colSpan={4}>No expenses in this report.</td>
              </tr>
            ) : (
              summary.byCategory.map((row) => (
                <tr key={`${row.group}-${row.category}`}>
                  <td>{row.category}</td>
                  <td>{expenseGroupLabels[row.group]}</td>
                  <td>{formatMoney(row.amountCents)}</td>
                  <td>
                    {formatPercent(
                      summary.totalCents !== 0 ? row.amountCents / summary.totalCents : null,
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>By quarter</h2>
        <p>Calendar quarters for the lines in this report.</p>
        <table>
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {quarters.length === 0 ? (
              <tr>
                <td colSpan={3}>No expenses in this report.</td>
              </tr>
            ) : (
              quarters.flatMap((quarter) => [
                ...quarter.byCategory.map((row) => (
                  <tr key={`${quarter.label}-${row.category}`}>
                    <td>{quarter.label}</td>
                    <td>{row.category}</td>
                    <td>{formatMoney(row.amountCents)}</td>
                  </tr>
                )),
                <tr key={`${quarter.label}-total`}>
                  <th>{quarter.label} total</th>
                  <th />
                  <th>{formatMoney(quarter.amountCents)}</th>
                </tr>,
              ])
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Posted lines</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>What posted</th>
              <th>Category</th>
              <th>Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {summary.entries.length === 0 ? (
              <tr>
                <td colSpan={5}>No posted lines for these filters.</td>
              </tr>
            ) : (
              summary.entries.map((entry, index) => (
                <tr key={`${entry.isoDate}-${entry.description}-${index}`}>
                  <td>{formatShortDate(entry.isoDate)}</td>
                  <td>{entry.description}</td>
                  <td>{entry.category}</td>
                  <td>{expenseGroupLabels[entry.group]}</td>
                  <td>{formatMoney(entry.amountCents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
