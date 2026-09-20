import { FileClock, Mail, ScanSearch, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { DateRangeFilter } from "@/components/date-range-filter";
import { DocumentInboxList } from "@/components/document-inbox-list";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { hasCapability } from "@/lib/auth/capabilities";
import { requireCapability } from "@/lib/auth/session";
import { parseDateRangeParams } from "@/lib/date-range";
import { listDocumentInbox } from "@/services/documents/queries";
import { activeLocationName } from "@/services/locations/scope";

const pipeline = [
  ["Secured", "Original file stored with a SHA-256 fingerprint."],
  ["Extracted", "Vendor, invoice fields, line items, and totals proposed."],
  ["Matched", "Each line is cataloged to an AKA; Restaurant Store names are remembered."],
  ["Validated", "Arithmetic, duplicates, units, prices, and pages checked."],
  ["Approved", "An owner posts. Until then the invoice stays a draft."],
] as const;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireCapability("documents:view-normal");
  const range = parseDateRangeParams(await searchParams);
  const documents = await listDocumentInbox(session, {
    startsOn: range?.startsOn,
    endsOn: range?.endsOn,
  });
  const canDelete = hasCapability(session.role, "documents:delete");
  const locationName = activeLocationName(session);

  return (
    <>
      <PageHeader
        eyebrow="Source evidence"
        title="Document inbox"
        description={
          locationName
            ? `Documents for ${locationName} only. Other locations have their own inbox.`
            : "Every invoice, receipt, packing slip, credit, and statement keeps its immutable original and processing history."
        }
        actions={
          <Link href="/purchases/capture" className="button button-accent">
            <Upload size={17} />
            Upload document
          </Link>
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
              <h2>Inbox</h2>
              <p>Exceptions appear before routine, trusted documents.</p>
            </div>
            <StatusPill tone="neutral">
              {documents.length} document{documents.length === 1 ? "" : "s"}
            </StatusPill>
          </div>
          {documents.length === 0 ? (
            <div className="empty-state">
              <div>
                <div className="empty-state-icon">
                  <FileClock size={25} />
                </div>
                <h2>The inbox is ready</h2>
                <p>
                  Upload one document now. Inbound invoice email and historical
                  batch sources will join this same review queue.
                </p>
                <Link href="/purchases/capture" className="button">
                  <ScanSearch size={17} />
                  Choose a file
                </Link>
              </div>
            </div>
          ) : (
            <DocumentInboxList
              canDelete={canDelete}
              documents={documents.map((document) => ({
                id: document.id,
                filename: document.filename,
                status: document.status,
                documentType: document.documentType,
                vendorName: document.vendorName,
                receivedAt: document.receivedAt.toISOString(),
                totalCents: document.totalCents,
                invoiceCount: document.invoiceCount,
              }))}
            />
          )}
        </section>

        <aside className="content-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Posting safeguards</h2>
                <p>AI output never writes directly to the ledger.</p>
              </div>
              <ShieldCheck size={19} className="text-lime-700" />
            </div>
            <ul className="list">
              {pipeline.map(([label, detail], index) => (
                <li className="list-row" key={label}>
                  <div className="list-leading">{index + 1}</div>
                  <div className="list-copy">
                    <p className="list-title">{label}</p>
                    <p className="list-meta">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="callout">
            <Mail size={18} />
            <span>
              The dedicated invoice address becomes active only after its
              signed inbound webhook secret is configured.
            </span>
          </section>
        </aside>
      </div>
    </>
  );
}
