"use client";

import { Camera, CheckCircle2, FileText, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type CaptureState = "idle" | "uploading" | "accepted" | "error";

export function ReceiptCapture() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<CaptureState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("company_card");
  const [businessPurpose, setBusinessPurpose] = useState("");

  const previewUrl = useMemo(() => {
    if (!file || !file.type.startsWith("image/")) {
      return null;
    }
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setState("uploading");
    setMessage(null);

    const body = new FormData();
    body.set("file", file);
    body.set("paymentMethod", paymentMethod);
    if (businessPurpose.trim()) {
      body.set("businessPurpose", businessPurpose.trim());
    }

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as {
        data?: {
          documentId: string;
          status: string;
          processingQueued: boolean;
          persisted: boolean;
        };
        error?: { message: string };
      };

      if (!response.ok || !result.data) {
        throw new Error(result.error?.message ?? "The receipt was not accepted.");
      }

      setState("accepted");
      setMessage(
        result.data.processingQueued
          ? "Receipt secured. Extraction and duplicate checks are now queued."
          : "Receipt secured. It will remain safely staged until the processing worker is connected.",
      );
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "The receipt could not be uploaded.",
      );
    }
  }

  function chooseAnother() {
    setFile(null);
    setState("idle");
    setMessage(null);
    setBusinessPurpose("");
  }

  if (state === "accepted") {
    return (
      <section className="panel">
        <div className="empty-state">
          <div>
            <div className="empty-state-icon">
              <CheckCircle2 size={25} aria-hidden="true" />
            </div>
            <h2>Capture complete</h2>
            <p>{message}</p>
            <button type="button" className="button" onClick={chooseAnother}>
              Capture another receipt
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form className="content-grid content-grid-main" onSubmit={submit}>
      <section className="panel">
        <div className="panel-body">
          <label className="capture-dropzone">
            <input
              type="file"
              name="receipt"
              accept="image/jpeg,image/png,image/webp,application/pdf,text/csv"
              capture="environment"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setMessage(null);
                setState("idle");
              }}
              required
            />
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Receipt preview"
                fill
                unoptimized
                style={{ objectFit: "contain", padding: "12px" }}
              />
            ) : (
              <div>
                <div className="capture-dropzone-icon">
                  <Camera size={29} aria-hidden="true" />
                </div>
                <h2>Photograph the receipt</h2>
                <p>
                  Keep all four corners visible. You may also choose a PDF,
                  receipt image, or vendor CSV already saved on this device.
                  The same file cannot be uploaded twice for this location
                  until the existing copy is deleted.
                </p>
              </div>
            )}
          </label>

          {file ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-stone-50 p-3">
              <FileText size={18} className="shrink-0 text-stone-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <p className="text-xs text-muted">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                className="button button-quiet"
                onClick={chooseAnother}
              >
                Change
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="panel">
        <div className="panel-header">
          <div>
            <h2>Purchase context</h2>
            <p>Usually only the payment method is needed.</p>
          </div>
        </div>
        <div className="panel-body form-grid">
          <div className="field">
            <label htmlFor="payment-method">How was this paid?</label>
            <select
              id="payment-method"
              className="select"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option value="company_card">Company card</option>
              <option value="cash">Store cash</option>
              <option value="owner_paid">Owner paid</option>
              <option value="invoice_due">Invoice due later</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="business-purpose">
              Note <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="business-purpose"
              className="textarea"
              value={businessPurpose}
              onChange={(event) => setBusinessPurpose(event.target.value)}
              placeholder="Only needed when the purchase is unusual."
            />
          </div>

          <div className="callout">
            <FileText size={18} />
            <span>
              Uploading creates a secured draft. Inventory changes only after
              validation and approval.
            </span>
          </div>

          {message ? (
            <p
              role="alert"
              className={
                state === "error" ? "text-sm text-red-700" : "text-sm"
              }
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            className="button button-accent"
            disabled={!file || state === "uploading"}
          >
            {state === "uploading" ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <Camera size={18} />
            )}
            {state === "uploading" ? "Securing receipt…" : "Submit receipt"}
          </button>
        </div>
      </aside>
    </form>
  );
}
