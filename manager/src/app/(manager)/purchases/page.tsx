import { Camera, FileSearch, ReceiptText, Upload } from "lucide-react";
import Link from "next/link";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCapability } from "@/lib/auth/session";
import { parseDateRangeParams } from "@/lib/date-range";
import { formatMoney, formatShortDate } from "@/lib/format";
import { listPurchaseQueue } from "@/services/purchases/queries";
import { activeLocationName } from "@/services/locations/scope";

const intakeChannels = [
  {
    name: "Phone receipt capture",
    detail: "Wegmans, Restaurant Depot, and local purchases",
    status: "Ready",
    tone: "success" as const,
  },
  {
    name: "Dedicated invoice email",
    detail: "Restaurant Store, Fresh Baguettes, Odeko, and Amazon",
    status: "Configure",
    tone: "warning" as const,
  },
  {
    name: "Historical batch import",
    detail: "PDF, image, CSV, and XLSX with checksum manifest",
    status: "Tooling",
    tone: "info" as const,
  },
] as const;

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireCapability("purchase:capture");
  const range = parseDateRangeParams(await searchParams);
  const purchases = await listPurchaseQueue(session, {
    startsOn: range?.startsOn,
    endsOn: range?.endsOn,
  });
  const locationName = activeLocationName(session);

  return (
    <>
      <PageHeader
        eyebrow="Purchasing"
        title="Purchases and receiving"
        description={
          locationName
            ? `Purchases for ${locationName} only. Another location keeps its own invoices, receiving, and payables.`
            : "Documents arrive here first. Extraction creates a draft; approval and receiving create the permanent inventory and expense records."
        }
        actions={
          <>
            <Link href="/documents" className="button">
              <Upload size={17} />
              Import files
            </Link>
            <Link
              href="/purchases/capture"
              className="button button-accent"
            >
              <Camera size={17} />
              Capture receipt
            </Link>
          </>
        }
      />

      <DateRangeFilter
        from={range?.startsOn ?? ""}
        to={range?.endsOn ?? ""}
        allowAll
      />

      <div className="content-grid content-grid-main">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Purchase queue</h2>
              <p>New documents, match exceptions, and receiving tasks.</p>
            </div>
            <StatusPill tone={purchases.length === 0 ? "success" : "info"}>
              {purchases.length === 0
                ? "Clear"
                : `${purchases.length} purchase${purchases.length === 1 ? "" : "s"}`}
            </StatusPill>
          </div>
          {purchases.length === 0 ? (
            <div className="empty-state">
              <div>
                <div className="empty-state-icon">
                  <ReceiptText size={25} />
                </div>
                <h2>No purchase documents yet</h2>
                <p>
                  Capture the next receipt or import an invoice. The original is
                  stored before any extraction or matching begins.
                </p>
                <Link
                  href="/purchases/capture"
                  className="button button-primary"
                >
                  <Camera size={17} />
                  Capture first receipt
                </Link>
              </div>
            </div>
          ) : (
            <ul className="list">
              {purchases.map((purchase) => (
                <li className="list-row" key={purchase.id}>
                  <div className="list-leading">
                    <ReceiptText size={18} />
                  </div>
                  <div className="list-copy">
                    <p className="list-title">{purchase.vendorName}</p>
                    <p className="list-meta">
                      {formatShortDate(purchase.purchaseDate)} ·{" "}
                      {purchase.sourceSystem ?? "manual"}
                    </p>
                  </div>
                  <p className="list-amount">
                    {formatMoney(purchase.totalCents, purchase.currency)}
                  </p>
                  <StatusPill
                    tone={
                      purchase.status === "posted" ? "success" : "warning"
                    }
                  >
                    {purchase.status}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="panel">
          <div className="panel-header">
            <div>
              <h2>Capture channels</h2>
              <p>One queue, regardless of source.</p>
            </div>
          </div>
          <ul className="list">
            {intakeChannels.map((channel) => (
              <li className="list-row" key={channel.name}>
                <div className="list-leading">
                  <FileSearch size={18} />
                </div>
                <div className="list-copy">
                  <p className="list-title">{channel.name}</p>
                  <p className="list-meta">{channel.detail}</p>
                </div>
                <StatusPill tone={channel.tone}>{channel.status}</StatusPill>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
