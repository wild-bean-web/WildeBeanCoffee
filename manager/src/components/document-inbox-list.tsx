"use client";

import { FileClock, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { formatMoney, formatShortDate } from "@/lib/format";

export interface DocumentInboxListItem {
  id: string;
  filename: string;
  status: string;
  documentType: string;
  vendorName: string | null;
  receivedAt: string;
  totalCents: number | null;
  invoiceCount: number | null;
}

function statusTone(status: string) {
  if (status === "posted" || status === "approved") return "success" as const;
  if (status === "failure" || status === "voided") return "danger" as const;
  if (status === "needs_review") return "warning" as const;
  return "info" as const;
}

export function DocumentInboxList({
  documents,
  canDelete,
}: {
  documents: DocumentInboxListItem[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function removeDocument(document: DocumentInboxListItem) {
    const postedPayroll =
      document.documentType === "payroll" && document.status === "posted";
    const confirmed = window.confirm(
      postedPayroll
        ? `Void posted payroll ${document.filename}? Loaded labor comes off the P&L. You can upload this pay period again after it is voided.`
        : `Remove ${document.filename} from the inbox? This cannot be used after it is deleted. You can upload the file again later if it was a mistake.`,
    );
    if (!confirmed) return;

    setPendingId(document.id);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(result.error?.message ?? "The document was not deleted.");
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The document could not be deleted.",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <ul className="list">
        {documents.map((document) => (
          <li className="list-row" key={document.id}>
            <Link href={`/documents/${document.id}`} className="list-row-main">
              <div className="list-leading">
                <FileClock size={18} />
              </div>
              <div className="list-copy">
                <p className="list-title">{document.filename}</p>
                <p className="list-meta">
                  {document.invoiceCount && document.invoiceCount > 1
                    ? `${document.invoiceCount} invoices in this file · `
                    : null}
                  {document.vendorName ?? "Vendor pending"} ·{" "}
                  {formatShortDate(document.receivedAt)}
                  {document.totalCents === null ||
                  (document.invoiceCount && document.invoiceCount > 1)
                    ? ""
                    : ` · ${formatMoney(document.totalCents)}`}
                </p>
              </div>
              <StatusPill tone={statusTone(document.status)}>
                {document.status.replace("_", " ")}
              </StatusPill>
            </Link>
            {canDelete &&
            (document.status !== "posted" ||
              document.documentType === "payroll") ? (
              <button
                type="button"
                className="icon-button icon-button-danger"
                aria-label={
                  document.documentType === "payroll" &&
                  document.status === "posted"
                    ? `Void posted payroll ${document.filename}`
                    : `Delete ${document.filename}`
                }
                disabled={pendingId === document.id}
                onClick={() => void removeDocument(document)}
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
