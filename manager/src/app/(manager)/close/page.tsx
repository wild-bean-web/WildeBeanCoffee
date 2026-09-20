import {
  Banknote,
  CircleDashed,
  FileSpreadsheet,
  LockKeyhole,
  Scale,
} from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCapability } from "@/lib/auth/session";
import { parseDateRangeParams, monthEndIso, monthStartIso, todayIso } from "@/lib/date-range";
import { formatMoney } from "@/lib/format";
import { getCloseCostingPreview } from "@/services/inventory/queries";
import { activeLocationName } from "@/services/locations/scope";

const closeSteps = [
  ["Sales and tenders", "Clover, website, DoorDash, Uber Eats, and cash"],
  ["Payouts and deposits", "Processor clearing matched to bank deposits"],
  ["Purchases and credits", "Invoices, receipts, card charges, returns, credits"],
  ["Physical inventory", "Complete blind count and approved recounts"],
  ["COGS and variance", "Periodic weighted average, waste, recipe variance"],
  ["Operating expenses", "Labor, rent, utilities, subscriptions, and assets"],
] as const;

function costingNote(
  status: Awaited<ReturnType<typeof getCloseCostingPreview>>["status"],
) {
  switch (status) {
    case "awaiting_ledger":
      return "Connect the manager database";
    case "awaiting_baseline":
      return "Awaiting opening count";
    case "awaiting_closing_count":
      return "Awaiting period-end count";
    case "awaiting_period":
      return "No accounting period is open";
    case "awaiting_costs":
      return "Receipts need unit costs";
    case "ready_to_value":
      return "Weighted-average draft";
  }
}

export default async function ClosePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireCapability("close:review");
  const today = todayIso();
  const range = parseDateRangeParams(await searchParams);
  const preview = await getCloseCostingPreview(session, {
    asOf: range?.endsOn,
  });
  const locationName = activeLocationName(session);
  const completedSteps =
    (preview.snapshot.currentPeriod ? 1 : 0) +
    (preview.snapshot.baselinePosted ? 1 : 0) +
    (preview.snapshot.postedCountCount >= 2 ? 1 : 0);
  const inventoryValue = preview.postingValueCents?.endingInventory;

  return (
    <>
      <PageHeader
        eyebrow="Financial controls"
        title="Monthly close"
        description={
          locationName
            ? `Period close and inventory valuation for ${locationName}. Each location closes independently.`
            : "A guided checklist turns operational records into a reproducible period. Nothing locks until all required controls agree."
        }
        actions={
          <button type="button" className="button" disabled>
            <FileSpreadsheet size={17} />
            Export after close
          </button>
        }
      />

      <DateRangeFilter
        from={
          range?.startsOn ??
          preview.snapshot.currentPeriod?.startsOn ??
          monthStartIso(today)
        }
        to={
          range?.endsOn ??
          preview.snapshot.currentPeriod?.endsOn ??
          monthEndIso(today)
        }
      />

      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-label">
            <span>Close progress</span>
            <CircleDashed className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{completedSteps} / 6</p>
          <p className="metric-note">
            {preview.snapshot.currentPeriod?.name ?? "No period opened"}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Recorded waste</span>
            <Banknote className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{preview.snapshot.wasteThisPeriod}</p>
          <p className="metric-note">Movements this period</p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Inventory value</span>
            <Scale className="metric-icon" size={18} />
          </div>
          <p className="metric-value">
            {inventoryValue === undefined || inventoryValue === null
              ? "—"
              : formatMoney(inventoryValue)}
          </p>
          <p className="metric-note">{costingNote(preview.status)}</p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Period status</span>
            <LockKeyhole className="metric-icon" size={18} />
          </div>
          <p className="metric-value">
            {preview.snapshot.currentPeriod?.status ?? "Open"}
          </p>
          <p className="metric-note">Posting is allowed</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Close checklist</h2>
            <p>Each completed step retains its evidence and approver.</p>
          </div>
          <StatusPill
            tone={preview.snapshot.baselinePosted ? "info" : "neutral"}
          >
            {preview.snapshot.baselinePosted ? "Baseline posted" : "Not started"}
          </StatusPill>
        </div>
        <ul className="list">
          {closeSteps.map(([title, detail], index) => {
            const done =
              (index === 3 && preview.snapshot.postedCountCount >= 2) ||
              (index === 4 && preview.status === "ready_to_value");
            return (
              <li className="list-row" key={title}>
                <div className="list-leading">{index + 1}</div>
                <div className="list-copy">
                  <p className="list-title">{title}</p>
                  <p className="list-meta">{detail}</p>
                </div>
                <StatusPill tone={done ? "success" : "neutral"}>
                  {done ? "Ready" : "Pending"}
                </StatusPill>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
