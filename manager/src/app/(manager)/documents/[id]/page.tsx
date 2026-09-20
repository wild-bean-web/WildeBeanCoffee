import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DocumentMatchingForm } from "@/components/document-matching";
import { DocumentPacketReview } from "@/components/document-packet-review";
import { PageHeader } from "@/components/page-header";
import {
  PayrollPreviewReview,
  PayrollVoidButton,
} from "@/components/payroll-preview-review";
import { hasCapability } from "@/lib/auth/capabilities";
import { requireCapability } from "@/lib/auth/session";
import { getDocumentMatching } from "@/services/documents/matching";
import { getDocumentReview } from "@/services/documents/queries";
import { getPayrollRunForDocument } from "@/services/payroll/runs";

function statusTone(status: string) {
  if (status === "posted" || status === "approved") return "success" as const;
  if (status === "failure" || status === "voided") return "danger" as const;
  if (status === "needs_review") return "warning" as const;
  return "info" as const;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCapability("documents:view-normal");
  const { id } = await params;
  const document = await getDocumentReview(session, id);
  if (!document) {
    notFound();
  }

  const originalUrl = `/api/documents/${document.id}`;

  if (document.documentType === "payroll") {
    if (!hasCapability(session.role, "payroll:view")) {
      notFound();
    }
    const workspace = await getPayrollRunForDocument(session, document.id);
    return (
      <>
        <PageHeader
          eyebrow="Labor"
          title={document.filename}
          description="Employee hours, wages, tips, taxes, and employer liabilities from the payroll preview. Posting records loaded labor for this location's P&L. Void a posted run to take it off the books and upload a replacement."
          actions={
            <Link href="/labor" className="button">
              <ArrowLeft size={17} />
              Back to labor
            </Link>
          }
        />
        {workspace ? (
          <PayrollPreviewReview
            documentId={document.id}
            filename={document.filename}
            mimeType={document.mimeType}
            originalUrl={originalUrl}
            run={workspace.run}
            employees={workspace.employees}
            canPost={hasCapability(session.role, "payroll:approve")}
          />
        ) : (
          <section className="callout">
            <div>
              <span>
                This payroll file is stored, but the preview could not be
                extracted. Remove it first if you need to upload the same PDF
                again.
              </span>
              {hasCapability(session.role, "payroll:approve") ? (
                <div className="mt-4">
                  <PayrollVoidButton documentId={document.id} />
                </div>
              ) : null}
            </div>
          </section>
        )}
      </>
    );
  }

  const invoiceCount = document.packet.invoices.length;
  const description =
    invoiceCount > 1
      ? `${invoiceCount} invoices were found in this file. All invoices shows the whole upload; select one to compare it with the original pages. Catalog each line to an AKA before an owner posts.`
      : "Compare the original file to the extracted draft, then catalog each line to a count-sheet AKA. The invoice stays a draft until an owner approves and posts.";

  let matching = null;
  let matchingError: string | null = null;
  if (
    ["needs_review", "approved", "posted", "auto_ready", "matched", "validated"].includes(
      document.status,
    )
  ) {
    try {
      matching = await getDocumentMatching(session, document.id, document.packet);
    } catch (error) {
      matchingError =
        error instanceof Error
          ? error.message
          : "Line matching is unavailable for this file.";
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Document review"
        title={document.filename}
        description={description}
        actions={
          <Link href="/documents" className="button">
            <ArrowLeft size={17} />
            Back to inbox
          </Link>
        }
      />

      {document.status === "posted" ? (
        <section className="callout mb-5">
          <span>
            <strong>Posted</strong> means this file is on the books for this
            location. Inventory moved for cataloged items that track stock.
          </span>
        </section>
      ) : (
        <section className="callout mb-5">
          <span>
            <strong>Needs review</strong> means Azure proposed vendor, totals,
            and lines. Give each line a short AKA for the count sheet. Until
            every line is mapped and an owner posts, this invoice stays a draft.
          </span>
        </section>
      )}

      {matchingError ? (
        <section className="callout mb-5">
          <span>{matchingError}</span>
        </section>
      ) : null}

      {matching ? (
        <DocumentMatchingForm
          workspace={matching}
          canCatalog={hasCapability(session.role, "purchase:review")}
          canPost={hasCapability(session.role, "purchase:approve")}
        />
      ) : null}

      <DocumentPacketReview
        originalUrl={originalUrl}
        filename={document.filename}
        mimeType={document.mimeType}
        extractionModel={document.extractionModel}
        statusLabel={statusLabel(document.status)}
        statusTone={statusTone(document.status)}
        receivedAt={document.receivedAt.toISOString()}
        packet={document.packet}
      />
    </>
  );
}
