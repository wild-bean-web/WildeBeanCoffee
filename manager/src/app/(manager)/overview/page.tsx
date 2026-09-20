import {
  ArrowRight,
  CircleAlert,
  CircleDollarSign,
  FileCheck2,
  PackageCheck,
  ReceiptText,
  ScanLine,
  ShoppingBasket,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { getManagerSession } from "@/lib/auth/session";
import { getInventoryControlSnapshot } from "@/services/inventory/queries";
import { getLocationSetup } from "@/services/locations/setup";
import { activeLocationName } from "@/services/locations/scope";

const setupSteps = [
  {
    label: "Capture the next company-card receipt",
    detail: "Start with Wegmans, Restaurant Depot, or any local purchase.",
    href: "/purchases/capture",
    key: "capture" as const,
  },
  {
    label: "Connect the dedicated invoice inbox",
    detail: "Forward Restaurant Store, Odeko, Amazon, and bakery invoices.",
    href: "/settings",
    key: "inbox" as const,
  },
  {
    label: "Prepare the opening inventory count",
    detail: "Build the count path by refrigerator, shelf, freezer, and counter.",
    href: "/inventory",
    key: "count" as const,
  },
] as const;

export default async function OverviewPage() {
  const session = await getManagerSession();
  const snapshot = session
    ? await getInventoryControlSnapshot(session)
    : null;
  const setup = session ? await getLocationSetup(session) : null;
  const locationName = session ? activeLocationName(session) : null;
  const countProgress =
    snapshot?.openCount && snapshot.openCount.totalLines > 0
      ? Math.round(
          (snapshot.openCount.countedLines / snapshot.openCount.totalLines) *
            100,
        )
      : 0;
  const cloverConfigured = setup?.clover.configured ?? false;
  const mailboxConfigured = setup?.mailbox.configured ?? false;
  const documentAiConfigured = setup?.brand.documentAiConfigured ?? false;

  return (
    <>
      <PageHeader
        eyebrow="Operations workspace"
        title={locationName ? `Today at ${locationName}` : "Today at Wild Bean"}
        description={
          locationName
            ? `This workspace is ${locationName} only. Switch locations in the sidebar to see another location's documents, inventory, and sales.`
            : "Capture what happened once. The system will organize purchases, inventory, sales, and close exceptions around the source record."
        }
        actions={
          <Link href="/purchases/capture" className="button button-accent">
            <ScanLine size={18} aria-hidden="true" />
            Capture receipt
          </Link>
        }
      />

      <section className="metrics-grid" aria-label="Operational summary">
        <article className="metric-card">
          <div className="metric-label">
            <span>Needs review</span>
            <CircleAlert className="metric-icon" size={18} />
          </div>
          <p className="metric-value">0</p>
          <p className="metric-note">Document exceptions</p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Unmatched card</span>
            <CircleDollarSign className="metric-icon" size={18} />
          </div>
          <p className="metric-value">$0</p>
          <p className="metric-note">Company-card charges</p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Count progress</span>
            <PackageCheck className="metric-icon" size={18} />
          </div>
          <p className="metric-value">
            {snapshot?.openCount ? `${countProgress}%` : "0%"}
          </p>
          <p className="metric-note">
            {snapshot?.baselinePosted
              ? "Baseline posted"
              : snapshot?.openCount
                ? snapshot.openCount.countNumber
                : "No active count"}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Sales status</span>
            <ShoppingBasket className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{cloverConfigured ? "Ready" : "—"}</p>
          <p className="metric-note">
            {cloverConfigured ? "Clover configured" : "Connect Clover"}
          </p>
        </article>
      </section>

      <div className="content-grid content-grid-main">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Start cleanly</h2>
              <p>These actions stop the data gap from getting larger.</p>
            </div>
            <StatusPill tone="info">Initial setup</StatusPill>
          </div>
          <ul className="list">
            {setupSteps.map((step, index) => {
              const status =
                step.key === "capture"
                  ? "Ready"
                  : step.key === "inbox"
                    ? mailboxConfigured
                      ? "Ready"
                      : "Configure"
                    : snapshot?.baselinePosted
                      ? "Posted"
                      : snapshot?.openCount
                        ? "In progress"
                        : "Not started";
              const label =
                step.key === "inbox"
                  ? mailboxConfigured
                    ? "Invoice mailbox connected"
                    : "Connect this store’s invoice mailbox"
                  : step.label;
              return (
              <li className="list-row" key={step.label}>
                <div className="list-leading">{index + 1}</div>
                <div className="list-copy">
                  <p className="list-title">{label}</p>
                  <p className="list-meta">{step.detail}</p>
                </div>
                <StatusPill
                  tone={
                    status === "Ready" || status === "Posted"
                      ? "success"
                      : status === "In progress"
                        ? "info"
                        : "neutral"
                  }
                >
                  {status}
                </StatusPill>
                <Link
                  href={
                    step.key === "inbox" && mailboxConfigured
                      ? "/documents"
                      : step.href
                  }
                  className="icon-button"
                  aria-label={`Open ${label}`}
                >
                  <ArrowRight size={18} />
                </Link>
              </li>
              );
            })}
          </ul>
        </section>

        <aside className="panel">
          <div className="panel-header">
            <div>
              <h2>Integration readiness</h2>
              <p>Separate manager credentials only.</p>
            </div>
          </div>
          <ul className="list">
            <li className="list-row">
              <div className="list-leading">
                <ShoppingBasket size={18} />
              </div>
              <div className="list-copy">
                <p className="list-title">Clover sales</p>
                <p className="list-meta">
                  {setup?.location
                    ? `Orders and tenders for ${setup.location.name}`
                    : "Orders, items, tenders, and refunds"}
                </p>
              </div>
              <StatusPill tone={cloverConfigured ? "success" : "warning"}>
                {cloverConfigured ? "Configured" : "Needs credentials"}
              </StatusPill>
            </li>
            <li className="list-row">
              <div className="list-leading">
                <ReceiptText size={18} />
              </div>
              <div className="list-copy">
                <p className="list-title">Document extraction</p>
                <p className="list-meta">Invoices and receipt images</p>
              </div>
              <StatusPill tone={documentAiConfigured ? "success" : "warning"}>
                {documentAiConfigured ? "Configured" : "Needs credentials"}
              </StatusPill>
            </li>
            <li className="list-row">
              <div className="list-leading">
                <FileCheck2 size={18} />
              </div>
              <div className="list-copy">
                <p className="list-title">Historical sources</p>
                <p className="list-meta">Manifest before any transformation</p>
              </div>
              <StatusPill tone="info">Tool ready</StatusPill>
            </li>
          </ul>
        </aside>
      </div>
    </>
  );
}
