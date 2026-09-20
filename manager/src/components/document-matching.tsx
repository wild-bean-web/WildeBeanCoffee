"use client";

import { Check, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { formatMoney } from "@/lib/format";
import type { DocumentMatchingWorkspace } from "@/services/documents/matching-types";

export function DocumentMatchingForm({
  workspace,
  canCatalog,
  canPost,
}: {
  workspace: DocumentMatchingWorkspace;
  canCatalog: boolean;
  canPost: boolean;
}) {
  const router = useRouter();
  const [akaDrafts, setAkaDrafts] = useState<Record<string, string>>({});
  const [existingDrafts, setExistingDrafts] = useState<Record<string, string>>(
    {},
  );
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const posted = workspace.status === "posted";

  const catalogOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const product of workspace.catalog) {
      options.set(product.id, product.name);
    }
    return options;
  }, [workspace.catalog]);

  async function run(
    lineId: string,
    request: () => Promise<Response>,
    success: (payload: {
      data?: { akaName?: string; sheetsUpdated?: number };
    }) => string,
  ) {
    setBusyLine(lineId);
    setMessage(null);
    try {
      const response = await request();
      const payload = (await response.json()) as {
        error?: { message: string };
        data?: { akaName?: string; sheetsUpdated?: number };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "The mapping was not saved.");
      }
      setMessage(success(payload));
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The mapping was not saved.",
      );
    } finally {
      setBusyLine(null);
    }
  }

  async function postDocument() {
    setPosting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/documents/${workspace.documentId}/post`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: { message: string };
        data?: { purchaseNumber?: string };
      };
      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "The invoice could not be posted.",
        );
      }
      setMessage(
        payload.data?.purchaseNumber
          ? `Posted as ${payload.data.purchaseNumber}.`
          : "Invoice posted.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The invoice could not be posted.",
      );
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="panel mb-5">
      <div className="panel-header">
        <div>
          <h2>Match to count-sheet names</h2>
          <p>
            {workspace.vendorName} invoice text stays as-is. The AKA is what
            staff count in the store. Remembered Restaurant Store names apply
            the next time the same SKU or description appears.
          </p>
        </div>
        <StatusPill
          tone={
            posted ? "success" : workspace.canApprove ? "info" : "warning"
          }
        >
          {posted
            ? "Posted"
            : `${workspace.mappedCount} of ${workspace.lineCount} mapped`}
        </StatusPill>
      </div>

      {workspace.lineCount === 0 ? (
        <div className="panel-body">
          <p className="text-sm text-muted">
            No line items were extracted from this file.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor description</th>
                <th>AKA / count sheet</th>
                <th className="numeric">Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {workspace.lines.map((line) => {
                const aka = akaDrafts[line.documentLineId] ?? line.suggestedAka;
                const existingId =
                  existingDrafts[line.documentLineId] ??
                  line.candidates[0]?.productId ??
                  "";
                const mapped =
                  line.status === "confirmed" || line.status === "remembered";
                const optionIds = new Set<string>();
                const options: Array<{ id: string; name: string }> = [];
                for (const candidate of line.candidates) {
                  if (optionIds.has(candidate.productId)) continue;
                  optionIds.add(candidate.productId);
                  options.push({
                    id: candidate.productId,
                    name: candidate.productName,
                  });
                }
                for (const [id, name] of catalogOptions) {
                  if (optionIds.has(id)) continue;
                  optionIds.add(id);
                  options.push({ id, name });
                }
                return (
                  <tr key={line.documentLineId}>
                    <td>
                      <p className="font-semibold">{line.vendorDescription}</p>
                      <p className="text-xs text-muted">
                        {[line.vendorSku, line.quantity, line.unit]
                          .filter(Boolean)
                          .join(" · ")}
                        {line.invoiceLabel ? ` · ${line.invoiceLabel}` : ""}
                      </p>
                    </td>
                    <td>
                      {mapped ? (
                        <div>
                          <p className="font-semibold">{line.akaName}</p>
                          <p className="text-xs text-muted">
                            {line.status === "remembered"
                              ? "Remembered vendor name"
                              : "Cataloged"}
                          </p>
                        </div>
                      ) : (
                        <input
                          className="input"
                          value={aka}
                          disabled={!canCatalog || posted}
                          onChange={(event) =>
                            setAkaDrafts((current) => ({
                              ...current,
                              [line.documentLineId]: event.target.value,
                            }))
                          }
                          aria-label={`AKA for ${line.vendorDescription}`}
                        />
                      )}
                    </td>
                    <td className="numeric">
                      {line.amountCents == null
                        ? "—"
                        : formatMoney(line.amountCents)}
                    </td>
                    <td>
                      {mapped || posted ? (
                        <StatusPill tone="success">
                          <Check size={12} />
                          Mapped
                        </StatusPill>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {canCatalog ? (
                            <button
                              type="button"
                              className="button button-accent"
                              disabled={busyLine === line.documentLineId}
                              onClick={() =>
                                void run(
                                  line.documentLineId,
                                  () =>
                                    fetch(
                                      `/api/documents/${workspace.documentId}/catalog`,
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          documentLineId: line.documentLineId,
                                          akaName: aka,
                                        }),
                                      },
                                    ),
                                  (payload) => {
                                    const sheets = payload.data?.sheetsUpdated ?? 0;
                                    return sheets > 0
                                      ? `${aka} added to the catalog and ${sheets} open count sheet${sheets === 1 ? "" : "s"}.`
                                      : `${aka} added to the catalog.`;
                                  },
                                )
                              }
                            >
                              {busyLine === line.documentLineId ? (
                                <LoaderCircle className="animate-spin" size={15} />
                              ) : (
                                <Plus size={15} />
                              )}
                              Catalog as AKA
                            </button>
                          ) : null}
                          {options.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <select
                                className="input"
                                value={existingId}
                                disabled={!canCatalog}
                                onChange={(event) =>
                                  setExistingDrafts((current) => ({
                                    ...current,
                                    [line.documentLineId]: event.target.value,
                                  }))
                                }
                                aria-label={`Existing catalog item for ${line.vendorDescription}`}
                              >
                                <option value="">Use existing AKA</option>
                                {options.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                              {canCatalog ? (
                                <button
                                  type="button"
                                  className="button"
                                  disabled={
                                    !existingId || busyLine === line.documentLineId
                                  }
                                  onClick={() =>
                                    void run(
                                      line.documentLineId,
                                      () =>
                                        fetch(
                                          `/api/documents/${workspace.documentId}/map`,
                                          {
                                            method: "POST",
                                            headers: {
                                              "Content-Type": "application/json",
                                            },
                                            body: JSON.stringify({
                                              documentLineId: line.documentLineId,
                                              productId: existingId,
                                            }),
                                          },
                                        ),
                                      () =>
                                        "Vendor name remembered for this AKA.",
                                    )
                                  }
                                >
                                  Use
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel-body flex flex-wrap items-center gap-3">
        {canPost && !posted ? (
          <button
            type="button"
            className="button button-primary"
            disabled={!workspace.canApprove || posting}
            onClick={() => void postDocument()}
          >
            {posting ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <Check size={17} />
            )}
            Approve and post
          </button>
        ) : null}
        {!canPost && !posted ? (
          <p className="text-sm text-muted">
            {workspace.canApprove
              ? "Every line is mapped. An owner can approve and post this invoice."
              : "Reviewed invoices stay drafts until every line has an AKA and an owner posts."}
          </p>
        ) : null}
        {canPost && !posted && !workspace.canApprove ? (
          <p className="text-sm text-muted">
            Map every line before this invoice can post. Until then it stays a
            draft.
          </p>
        ) : null}
        {message ? <p className="text-sm text-muted">{message}</p> : null}
      </div>
    </section>
  );
}
