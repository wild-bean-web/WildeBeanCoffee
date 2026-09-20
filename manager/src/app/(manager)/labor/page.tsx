import { Banknote, Clock3, Users } from "lucide-react";
import Link from "next/link";
import { CloverLaborImport } from "@/components/clover-labor-import";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { PayrollCapture } from "@/components/payroll-capture";
import { StatusPill } from "@/components/status-pill";
import { hasCapability } from "@/lib/auth/capabilities";
import { requireCapability } from "@/lib/auth/session";
import {
  monthStartIso,
  parseDateRangeParams,
  todayIso,
} from "@/lib/date-range";
import { formatHours, formatMoney, formatShortDate } from "@/lib/format";
import { getLocationSetup } from "@/services/locations/setup";
import { activeLocationName } from "@/services/locations/scope";
import { listPayrollRuns } from "@/services/payroll/runs";

function statusTone(status: string) {
  if (status === "posted") return "success" as const;
  if (status === "voided") return "danger" as const;
  return "warning" as const;
}

export default async function LaborPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireCapability("payroll:view");
  const today = todayIso();
  const range = parseDateRangeParams(await searchParams);
  const runs = await listPayrollRuns(
    session,
    range
      ? { limit: 100, startsOn: range.startsOn, endsOn: range.endsOn }
      : 48,
  );
  const locationName = activeLocationName(session);
  const canCapture = hasCapability(session.role, "payroll:capture");
  const setup = await getLocationSetup(session);
  const importFrom = range?.startsOn ?? monthStartIso(today);
  const importTo = range?.endsOn ?? today;
  const posted = runs.filter((run) => run.status === "posted");
  const latestPosted = posted[0];
  const laborInRange = posted.reduce((sum, run) => sum + run.loadedLaborCents, 0);
  const hoursInRange = posted.reduce(
    (sum, run) => sum + Number.parseFloat(run.totalHours || "0"),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Labor cost"
        title="Payroll"
        description={
          locationName
            ? `Clover time clock hours for ${locationName}, priced from the last posted Paychex rates. Upload a Paychex preview when you need taxes and net pay from payroll.`
            : "Import Clover clock hours for the selected range, or upload a Paychex payroll preview. Loaded labor is wages plus employer tax; tips are not a store expense."
        }
        actions={
          canCapture ? (
            <CloverLaborImport
              from={importFrom}
              to={importTo}
              configured={setup.clover.configured}
            />
          ) : null
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
            <span>{range ? "Posted labor in range" : "Latest posted labor"}</span>
            <Banknote className="metric-icon" size={18} />
          </div>
          <p className="metric-value">
            {range
              ? posted.length > 0
                ? formatMoney(laborInRange)
                : "—"
              : latestPosted
                ? formatMoney(latestPosted.loadedLaborCents)
                : "—"}
          </p>
          <p className="metric-note">
            {range
              ? `${posted.length} posted run${posted.length === 1 ? "" : "s"}`
              : latestPosted?.periodEndsOn
                ? `Period ending ${formatShortDate(latestPosted.periodEndsOn)}`
                : "Awaiting first posted preview"}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>People on latest run</span>
            <Users className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{latestPosted?.employeeCount ?? "—"}</p>
          <p className="metric-note">From the payroll preview</p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Hours</span>
            <Clock3 className="metric-icon" size={18} />
          </div>
          <p className="metric-value">
            {range
              ? posted.length > 0
                ? formatHours(hoursInRange)
                : "—"
              : latestPosted
                ? formatHours(latestPosted.totalHours)
                : "—"}
          </p>
          <p className="metric-note">Regular + overtime</p>
        </article>
      </section>

      <div className="content-grid content-grid-main mt-5">
        {canCapture ? <PayrollCapture /> : null}

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Pay periods</h2>
              <p>Drafts stay off the P&L until an owner posts labor cost. Void a posted run to take it off the books and upload a replacement.</p>
            </div>
            <StatusPill tone="neutral">
              {runs.length} preview{runs.length === 1 ? "" : "s"}
            </StatusPill>
          </div>
          {runs.length === 0 ? (
            <div className="empty-state">
              <div>
                <h2>No payroll uploaded yet</h2>
                <p>
                  After the next pay period ends, import Clover clock hours or
                  upload the Paychex payroll preview PDF. Clover hours are
                  priced from the last posted Paychex rates.
                </p>
              </div>
            </div>
          ) : (
            <ul className="list">
              {runs.map((run) => (
                <li className="list-row" key={run.id}>
                  <Link
                    href={`/documents/${run.sourceDocumentId}`}
                    className="list-row-main"
                  >
                    <div className="list-copy">
                      <p className="list-title">
                        {run.periodStartsOn && run.periodEndsOn
                          ? `${formatShortDate(run.periodStartsOn)} – ${formatShortDate(run.periodEndsOn)}`
                          : run.companyName ?? "Payroll preview"}
                      </p>
                      <p className="list-meta">
                        {run.employeeCount} employees ·{" "}
                        {formatHours(run.totalHours)} hrs · Labor{" "}
                        {formatMoney(run.loadedLaborCents)}
                        {run.checkDate
                          ? ` · Check ${formatShortDate(run.checkDate)}`
                          : ""}
                      </p>
                    </div>
                    <StatusPill tone={statusTone(run.status)}>
                      {run.status === "draft" ? "needs review" : run.status}
                    </StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
