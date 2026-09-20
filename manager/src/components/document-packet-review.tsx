"use client";

import { Fragment, useMemo, useState } from "react";
import { DocumentOriginalPreview } from "@/components/document-original-preview";
import { StatusPill } from "@/components/status-pill";
import {
  sumProposedMoney,
  type ProposedInvoice,
  type ProposedInvoicePacket,
} from "@/integrations/document-ai/packet";
import { formatMoney, formatShortDate, parseMoneyToCents } from "@/lib/format";

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="field">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--coffee-950)]">
        {value ?? "—"}
      </p>
    </div>
  );
}

function pageLabel(pages: number[]): string | null {
  if (pages.length === 0) return null;
  if (pages.length === 1) return `p. ${pages[0]}`;
  return `pp. ${pages[0]}–${pages[pages.length - 1]}`;
}

function displayLine(line: ProposedInvoice["lines"][number]) {
  if (line.productCode) {
    return { sku: line.productCode, description: line.description };
  }
  const match = line.description?.match(/^([A-Z0-9][A-Z0-9-]{3,})\s+(.+)$/i);
  if (match) {
    return { sku: match[1], description: match[2] };
  }
  return { sku: null, description: line.description };
}

function moneyLabel(cents: number, missing: number): string {
  const value = formatMoney(cents);
  return missing > 0 ? `${value}*` : value;
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function uniqueValues(values: Array<string | null>): string | null {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))];
  if (unique.length === 0) return null;
  return unique.join(" · ");
}

function sumField(
  invoices: readonly ProposedInvoice[],
  field: "subtotal" | "tax" | "total",
): { cents: number; parsed: number; missing: number } {
  let cents = 0;
  let parsed = 0;
  let missing = 0;
  for (const invoice of invoices) {
    const amount = parseMoneyToCents(invoice[field]);
    if (amount === null) {
      missing += 1;
    } else {
      cents += amount;
      parsed += 1;
    }
  }
  return { cents, parsed, missing };
}

function invoiceTitle(invoice: ProposedInvoice, index: number): string {
  return invoice.invoiceId ?? `Invoice ${index + 1}`;
}

function LineItemsTable({
  invoices,
  grouped,
  onSelectInvoice,
}: {
  invoices: ProposedInvoice[];
  grouped: boolean;
  onSelectInvoice?: (index: number) => void;
}) {
  const totals = sumProposedMoney(invoices);

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>SKU</th>
            <th className="numeric">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice, invoiceIndex) => {
            const invoiceTotals = sumProposedMoney([invoice]);
            return (
              <Fragment key={`${invoice.invoiceId ?? "invoice"}-${invoiceIndex}`}>
                {grouped ? (
                  <tr className="group-row">
                    <th colSpan={5}>
                      {onSelectInvoice ? (
                        <button
                          type="button"
                          className="table-group-link"
                          onClick={() => onSelectInvoice(invoiceIndex)}
                        >
                          {invoiceTitle(invoice, invoiceIndex)}
                          {invoice.kind === "credit" ? " · Credit" : " · Invoice"}
                          {pageLabel(invoice.pages)
                            ? ` · ${pageLabel(invoice.pages)}`
                            : ""}
                          {invoice.total ? ` · ${invoice.total}` : ""}
                        </button>
                      ) : (
                        invoiceTitle(invoice, invoiceIndex)
                      )}
                    </th>
                  </tr>
                ) : null}
                {invoice.lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-muted">
                      No line items were proposed for this invoice.
                    </td>
                  </tr>
                ) : (
                  invoice.lines.map((line, lineIndex) => {
                    const displayed = displayLine(line);
                    return (
                      <tr
                        key={`${displayed.sku ?? displayed.description ?? "line"}-${lineIndex}`}
                      >
                        <td>{displayed.description ?? "—"}</td>
                        <td>{line.quantity ?? "—"}</td>
                        <td>{line.unit ?? "—"}</td>
                        <td>{displayed.sku ?? "—"}</td>
                        <td className="numeric">
                          {line.amount ?? line.unitPrice ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
                {grouped ? (
                  <tr className="group-subtotal">
                    <th colSpan={4}>
                      Line items on {invoiceTitle(invoice, invoiceIndex)}
                    </th>
                    <td className="numeric">
                      {invoiceTotals.lineItemsParsed > 0
                        ? moneyLabel(
                            invoiceTotals.lineItemsCents,
                            invoiceTotals.lineItemsMissing,
                          )
                        : "—"}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4}>
              {grouped ? "Line items in this file" : "Line items on this invoice"}
            </th>
            <td className="numeric">
              {totals.lineItemsParsed > 0
                ? moneyLabel(totals.lineItemsCents, totals.lineItemsMissing)
                : "—"}
            </td>
          </tr>
          <tr>
            <th colSpan={4}>
              {grouped ? "Invoice totals in this file" : "Invoice total"}
            </th>
            <td className="numeric">
              {totals.invoiceTotalsParsed > 0
                ? moneyLabel(totals.invoiceTotalCents, totals.invoiceTotalsMissing)
                : (invoices[0]?.total ?? "—")}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function DocumentPacketReview({
  originalUrl,
  filename,
  mimeType,
  extractionModel,
  statusLabel,
  statusTone,
  receivedAt,
  packet,
}: {
  originalUrl: string;
  filename: string;
  mimeType: string;
  extractionModel: string | null;
  statusLabel: string;
  statusTone: "success" | "danger" | "warning" | "info";
  receivedAt: string;
  packet: ProposedInvoicePacket;
}) {
  const invoices = packet.invoices;
  const [selectedIndex, setSelectedIndex] = useState<number | "all">(
    () => (invoices.length > 1 ? "all" : 0),
  );
  const viewingAll = invoices.length > 1 && selectedIndex === "all";
  const selected =
    viewingAll || selectedIndex === "all"
      ? null
      : (invoices[selectedIndex] ?? invoices[0] ?? null);
  const creditCount = invoices.filter((invoice) => invoice.kind === "credit").length;
  const invoiceCount = invoices.length - creditCount;
  const packetTotals = useMemo(() => sumProposedMoney(invoices), [invoices]);
  const fileSubtotal = useMemo(() => sumField(invoices, "subtotal"), [invoices]);
  const fileTax = useMemo(() => sumField(invoices, "tax"), [invoices]);
  const fileVendor = useMemo(
    () => uniqueValues(invoices.map((invoice) => invoice.vendorName)),
    [invoices],
  );
  const fileOrderNumber = useMemo(
    () => uniqueValues(invoices.map((invoice) => invoice.orderNumber)),
    [invoices],
  );
  const summary = useMemo(() => {
    if (invoices.length <= 1) {
      return extractionModel ? `Azure ${extractionModel}` : "No extraction yet";
    }
    const parts = [countLabel(invoiceCount, "invoice")];
    if (creditCount > 0) {
      parts.push(countLabel(creditCount, "credit"));
    }
    return `${parts.join(" · ")} in this file`;
  }, [creditCount, extractionModel, invoiceCount, invoices.length]);
  const visibleInvoices = viewingAll ? invoices : selected ? [selected] : [];
  const hasVisibleLines = visibleInvoices.some((invoice) => invoice.lines.length > 0);

  return (
    <>
      {invoices.length > 0 ? (
        <section className="metrics-grid" aria-label="File totals">
          <article className="metric-card">
            <p className="metric-label">Invoices in this file</p>
            <p className="metric-value">{invoices.length}</p>
            <p className="metric-note">
              {countLabel(invoiceCount, "invoice")}
              {creditCount > 0 ? ` · ${countLabel(creditCount, "credit")}` : ""}
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Invoice totals</p>
            <p className="metric-value">
              {packetTotals.invoiceTotalsParsed > 0
                ? moneyLabel(
                    packetTotals.invoiceTotalCents,
                    packetTotals.invoiceTotalsMissing,
                  )
                : "—"}
            </p>
            <p className="metric-note">
              Sum of every invoice and credit total, including tax
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Line items</p>
            <p className="metric-value">
              {packetTotals.lineItemsParsed > 0
                ? moneyLabel(
                    packetTotals.lineItemsCents,
                    packetTotals.lineItemsMissing,
                  )
                : "—"}
            </p>
            <p className="metric-note">
              {countLabel(packetTotals.lineCount, "proposed line")} · usually
              the merchandise subtotal
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Difference</p>
            <p className="metric-value">
              {packetTotals.invoiceTotalsParsed > 0 &&
              packetTotals.lineItemsParsed > 0
                ? formatMoney(
                    packetTotals.invoiceTotalCents - packetTotals.lineItemsCents,
                  )
                : "—"}
            </p>
            <p className="metric-note">
              Invoice totals minus line items. This should match tax when
              every line was read.
            </p>
          </article>
        </section>
      ) : null}

      {invoices.length > 1 ? (
        <section className="callout mb-5">
          <span>
            All invoices shows every draft and line in this upload. Select one
            invoice to compare it with its original pages. They will post
            separately later.
            {packet.truncatedExtraction
              ? ` Azure only returned ${packet.analyzedPageCount} of ${packet.pageCount} pages, so the remaining invoices were read from the original file.`
              : null}
          </span>
        </section>
      ) : null}

      <div className="content-grid content-grid-main">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Original file</h2>
              <p>
                {mimeType}
                {packet.pageCount > 0 ? ` · ${packet.pageCount} pages` : ""}
              </p>
            </div>
            <a href={originalUrl} className="button" target="_blank" rel="noreferrer">
              Open in a new tab
            </a>
          </div>
          <div className="panel-body">
            <DocumentOriginalPreview
              src={originalUrl}
              title={filename}
              mimeType={mimeType}
              focusPage={viewingAll ? undefined : selected?.pages[0]}
              highlightPages={viewingAll ? [] : (selected?.pages ?? [])}
            />
          </div>
        </section>

        <aside className="content-grid">
          {invoices.length > 1 ? (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Invoices in this file</h2>
                  <p>{summary}</p>
                </div>
              </div>
              <div className="invoice-switcher" role="tablist" aria-label="Invoices in this file">
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewingAll}
                  className={
                    viewingAll
                      ? "invoice-switcher-item is-all is-active"
                      : "invoice-switcher-item is-all"
                  }
                  onClick={() => setSelectedIndex("all")}
                >
                  <span className="invoice-switcher-title">All invoices</span>
                  <span className="invoice-switcher-meta">
                    {summary}
                    {packetTotals.invoiceTotalsParsed > 0
                      ? ` · ${moneyLabel(
                          packetTotals.invoiceTotalCents,
                          packetTotals.invoiceTotalsMissing,
                        )}`
                      : ""}
                  </span>
                </button>
                {invoices.map((invoice, index) => {
                  const selectedInvoice = selectedIndex === index;
                  return (
                    <button
                      key={`${invoice.invoiceId ?? "invoice"}-${index}`}
                      type="button"
                      role="tab"
                      aria-selected={selectedInvoice}
                      className={
                        selectedInvoice
                          ? "invoice-switcher-item is-active"
                          : "invoice-switcher-item"
                      }
                      onClick={() => setSelectedIndex(index)}
                    >
                      <span className="invoice-switcher-title">
                        {invoiceTitle(invoice, index)}
                      </span>
                      <span className="invoice-switcher-meta">
                        {invoice.kind === "credit" ? "Credit" : "Invoice"}
                        {pageLabel(invoice.pages) ? ` · ${pageLabel(invoice.pages)}` : ""}
                        {invoice.total ? ` · ${invoice.total}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>
                  {viewingAll
                    ? "File details"
                    : selected?.kind === "credit"
                      ? "Draft credit"
                      : invoices.length > 1
                        ? "Draft invoice"
                        : "Draft extraction"}
                </h2>
                <p>
                  {viewingAll
                    ? "Shared fields for this upload"
                    : typeof selectedIndex === "number"
                      ? `${selectedIndex + 1} of ${invoices.length}`
                      : summary}
                </p>
              </div>
              <StatusPill
                tone={
                  viewingAll
                    ? statusTone
                    : selected?.kind === "credit"
                      ? "danger"
                      : statusTone
                }
              >
                {viewingAll
                  ? statusLabel
                  : selected?.kind === "credit"
                    ? "credit"
                    : statusLabel}
              </StatusPill>
            </div>
            <div className="panel-body form-grid">
              {viewingAll ? (
                <>
                  <Field label="Vendor" value={fileVendor} />
                  <Field label="Order number" value={fileOrderNumber} />
                  <Field
                    label="Invoices"
                    value={`${invoices.length} · ${summary}`}
                  />
                  <Field label="Received" value={formatShortDate(receivedAt)} />
                </>
              ) : (
                <>
                  <Field label="Vendor" value={selected?.vendorName ?? null} />
                  <Field label="Invoice number" value={selected?.invoiceId ?? null} />
                  <Field label="Invoice date" value={selected?.invoiceDate ?? null} />
                  <Field label="Order number" value={selected?.orderNumber ?? null} />
                  <Field label="Subtotal" value={selected?.subtotal ?? null} />
                  <Field label="Tax" value={selected?.tax ?? null} />
                  <Field label="Total" value={selected?.total ?? null} />
                  <Field label="Received" value={formatShortDate(receivedAt)} />
                </>
              )}
            </div>
          </section>
        </aside>
      </div>

      {viewingAll ? (
        <section className="panel mt-5">
          <div className="panel-header">
            <div>
              <h2>Draft invoices</h2>
              <p>
                Every invoice and credit in this upload. Select a row to open
                that invoice by itself.
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Kind</th>
                  <th>Date</th>
                  <th>Pages</th>
                  <th>Lines</th>
                  <th className="numeric">Subtotal</th>
                  <th className="numeric">Tax</th>
                  <th className="numeric">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice, index) => (
                  <tr key={`${invoice.invoiceId ?? "invoice"}-${index}`}>
                    <td>
                      <button
                        type="button"
                        className="table-group-link"
                        onClick={() => setSelectedIndex(index)}
                      >
                        {invoiceTitle(invoice, index)}
                      </button>
                    </td>
                    <td>{invoice.kind === "credit" ? "Credit" : "Invoice"}</td>
                    <td>{invoice.invoiceDate ?? "—"}</td>
                    <td>{pageLabel(invoice.pages) ?? "—"}</td>
                    <td>{invoice.lines.length}</td>
                    <td className="numeric">{invoice.subtotal ?? "—"}</td>
                    <td className="numeric">{invoice.tax ?? "—"}</td>
                    <td className="numeric">{invoice.total ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={5}>File totals</th>
                  <td className="numeric">
                    {fileSubtotal.parsed > 0
                      ? moneyLabel(fileSubtotal.cents, fileSubtotal.missing)
                      : "—"}
                  </td>
                  <td className="numeric">
                    {fileTax.parsed > 0
                      ? moneyLabel(fileTax.cents, fileTax.missing)
                      : "—"}
                  </td>
                  <td className="numeric">
                    {packetTotals.invoiceTotalsParsed > 0
                      ? moneyLabel(
                          packetTotals.invoiceTotalCents,
                          packetTotals.invoiceTotalsMissing,
                        )
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      {hasVisibleLines || viewingAll ? (
        <section className="panel mt-5">
          <div className="panel-header">
            <div>
              <h2>Proposed line items</h2>
              <p>
                {viewingAll
                  ? "Every proposed line in this upload, grouped by invoice. They are not products in Wild Bean inventory yet."
                  : invoices.length > 1
                    ? "Lines for the selected invoice. They are not products in Wild Bean inventory yet."
                    : "These are suggestions from the document. They are not products in Wild Bean inventory yet."}
              </p>
            </div>
          </div>
          <LineItemsTable
            invoices={visibleInvoices}
            grouped={viewingAll}
            onSelectInvoice={
              viewingAll ? (index) => setSelectedIndex(index) : undefined
            }
          />
        </section>
      ) : (
        <section className="panel mt-5">
          <div className="panel-body">
            <p className="text-sm text-muted">
              {invoices.length > 0
                ? "No line items were proposed for this invoice. Use the original file on the left."
                : "Extraction has not finished for this file yet. The original is still stored."}
            </p>
          </div>
        </section>
      )}
    </>
  );
}
