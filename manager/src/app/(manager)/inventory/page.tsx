import {
  ClipboardList,
  MapPin,
  PackageCheck,
  Scale,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { CountAssignments } from "@/components/count-assignments";
import { CatalogImportPost } from "@/components/catalog-import-post";
import { CountSessionActions } from "@/components/count-session-actions";
import { WasteForm } from "@/components/waste-form";
import { hasCapability } from "@/lib/auth/capabilities";
import { requireCapability } from "@/lib/auth/session";
import { formatShortDate } from "@/lib/format";
import { listImportBatches } from "@/services/imports/queries";
import {
  countPath,
  getInventoryControlSnapshot,
  listCountableProducts,
} from "@/services/inventory/queries";
import { activeLocationName } from "@/services/locations/scope";

export default async function InventoryPage() {
  const session = await requireCapability("inventory:count");
  const canAdjust = hasCapability(session.role, "inventory:adjust");
  const canRecordWaste = hasCapability(session.role, "waste:record");
  const [importBatches, snapshot, products] = await Promise.all([
    listImportBatches(session),
    getInventoryControlSnapshot(session),
    listCountableProducts(session),
  ]);
  const stagedProducts = importBatches
    .filter((batch) => batch.importKind === "legacy_inventory")
    .reduce((total, batch) => total + batch.rowCount, 0);
  const countSections = countPath();
  const countProgress =
    snapshot.openCount && snapshot.openCount.totalLines > 0
      ? Math.round(
          (snapshot.openCount.countedLines / snapshot.openCount.totalLines) *
            100,
        )
      : 0;
  const locationName = activeLocationName(session);

  return (
    <>
      <PageHeader
        eyebrow="Inventory control"
        title="Opening baseline"
        description={
          locationName
            ? `On-hand quantities, counts, and waste for ${locationName} only. Staff count the AKA. Post the staged spreadsheet or catalog an invoice, then start a count.`
            : "The first approved physical count establishes trustworthy on-hand quantities. Earlier COGS stays visibly estimated."
        }
        actions={
          <CountSessionActions
            canAdjust={canAdjust}
            openCount={snapshot.openCount}
            productCount={snapshot.productCount}
          />
        }
      />

      <CountAssignments
        key={`${snapshot.openCount?.id ?? "none"}-${snapshot.openCount?.totalLines ?? 0}`}
      />

      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-label">
            <span>Count sections</span>
            <MapPin className="metric-icon" size={18} />
          </div>
          <p className="metric-value">{countSections.length}</p>
          <p className="metric-note">Initial walking path</p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Products mapped</span>
            <PackageCheck className="metric-icon" size={18} />
          </div>
          <p className="metric-value">
            {snapshot.productCount || stagedProducts}
          </p>
          <p className="metric-note">
            {snapshot.productCount > 0
              ? "AKA names on the count sheet"
              : stagedProducts > 0
                ? "Staged spreadsheet"
                : "Catalog from an invoice"}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Count progress</span>
            <Scale className="metric-icon" size={18} />
          </div>
          <p className="metric-value">
            {snapshot.openCount ? `${countProgress}%` : "—"}
          </p>
          <p className="metric-note">
            {snapshot.openCount
              ? `${snapshot.openCount.countedLines} of ${snapshot.openCount.totalLines} counted`
              : "Hidden until approval"}
          </p>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <span>Baseline status</span>
            <ClipboardList className="metric-icon" size={18} />
          </div>
          <p className="metric-value">
            {snapshot.baselinePosted
              ? "Posted"
              : snapshot.openCount?.status ?? "Draft"}
          </p>
          <p className="metric-note">
            {snapshot.baselinePosted
              ? snapshot.latestPostedCount?.countNumber
              : "No count posted"}
          </p>
        </article>
      </section>

      {canRecordWaste ? <WasteForm products={products} /> : null}

      <section className="panel mb-5">
        <div className="panel-header">
          <div>
            <h2>Count-sheet catalog</h2>
            <p>
              Staff count the AKA. Vendor invoice names stay on purchases. New
              catalog items are appended to every open count at every location.
            </p>
          </div>
          <StatusPill tone={products.length > 0 ? "success" : "warning"}>
            {products.length} item{products.length === 1 ? "" : "s"}
          </StatusPill>
        </div>
        {products.length === 0 ? (
          <div className="panel-body">
            <p className="text-sm text-muted">
              No store items are on the count sheet yet. Post the staged
              inventory spreadsheet, or catalog an invoice line with a short AKA
              such as “16 oz Plastic Cold Cup”, then start a count.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>AKA / count sheet</th>
                  <th>Vendor invoice name</th>
                  <th>Walking path</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="font-semibold">{product.name}</td>
                    <td>
                      <p>{product.vendorDescription ?? "—"}</p>
                      {product.vendorName ? (
                        <p className="text-xs text-muted">{product.vendorName}</p>
                      ) : null}
                    </td>
                    <td>{product.sectionName}</td>
                    <td>{product.unitSymbol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Count path</h2>
            <p>
              Counters see assigned locations and units, never expected stock or
              cost.
            </p>
          </div>
          <StatusPill tone="info">Blind count</StatusPill>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Physical section</th>
                <th>Typical contents</th>
                <th>Cadence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {countSections.map((section, index) => (
                <tr key={section.code}>
                  <td>{index + 1}</td>
                  <td className="font-semibold">{section.name}</td>
                  <td>{section.detail}</td>
                  <td>{section.cadence}</td>
                  <td>
                    <StatusPill
                      tone={
                        snapshot.productCount > 0 ? "success" : "neutral"
                      }
                    >
                      {snapshot.productCount > 0
                        ? "Ready for products"
                        : "Needs products"}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {importBatches.length > 0 ? (
        <section className="panel mt-5">
          <div className="panel-header">
            <div>
              <h2>Import staging</h2>
              <p>
                Count in each. Purchase packs stay on the vendor item. Posting
                writes AKA names onto this location&apos;s count sheet.
              </p>
            </div>
          </div>
          <ul className="list">
            {importBatches.map((batch) => (
              <li className="list-row" key={batch.id}>
                <div className="list-leading">
                  <ClipboardList size={18} />
                </div>
                <div className="list-copy">
                  <p className="list-title">{batch.sourceFilename}</p>
                  <p className="list-meta">
                    {batch.rowCount} rows · {formatShortDate(batch.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusPill
                    tone={
                      batch.status === "posted"
                        ? "success"
                        : batch.reviewCount > 0
                          ? "warning"
                          : "success"
                    }
                  >
                    {batch.status === "posted"
                      ? "Posted"
                      : batch.reviewCount > 0
                        ? `${batch.reviewCount} staged`
                        : batch.status}
                  </StatusPill>
                  {batch.importKind === "legacy_inventory" ? (
                    <CatalogImportPost
                      canPost={canAdjust}
                      batch={{
                        id: batch.id,
                        sourceFilename: batch.sourceFilename,
                        status: batch.status,
                        rowCount: batch.rowCount,
                        reviewCount: batch.reviewCount,
                      }}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
