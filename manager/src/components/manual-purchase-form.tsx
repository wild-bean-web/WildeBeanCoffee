"use client";

import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

export function ManualPurchaseForm() {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus("submitting");
    setMessage(null);

    const form = new FormData(formElement);
    const payload = {
      vendorName: form.get("vendorName"),
      purchaseDate: form.get("purchaseDate"),
      total: form.get("total"),
      paymentMethod: form.get("paymentMethod"),
      businessPurpose: form.get("businessPurpose"),
      itemDetails: form.get("itemDetails"),
      missingEvidence: true,
    };

    try {
      const response = await fetch("/api/purchases/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        data?: { purchaseDraftId: string };
        error?: { message: string };
      };
      if (!response.ok || !result.data) {
        throw new Error(result.error?.message ?? "Purchase was not saved.");
      }
      setStatus("saved");
      setMessage(
        "Manual purchase saved as a missing-evidence exception for owner review.",
      );
      formElement.reset();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Purchase was not saved.",
      );
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-header">
        <div>
          <h2>Purchase details</h2>
          <p>Use this only when no receipt or invoice can be recovered.</p>
        </div>
      </div>
      <div className="panel-body form-grid">
        <div className="form-grid form-grid-two">
          <div className="field">
            <label htmlFor="vendor-name">Vendor</label>
            <input
              id="vendor-name"
              name="vendorName"
              className="input"
              autoComplete="organization"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="purchase-date">Purchase date</label>
            <input
              id="purchase-date"
              name="purchaseDate"
              className="input"
              type="date"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="total">Total paid</label>
            <input
              id="total"
              name="total"
              className="input"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="manual-payment-method">Payment method</label>
            <select
              id="manual-payment-method"
              name="paymentMethod"
              className="select"
              defaultValue="company_card"
            >
              <option value="company_card">Company card</option>
              <option value="cash">Store cash</option>
              <option value="owner_paid">Owner paid</option>
              <option value="invoice_due">Invoice due later</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="business-purpose">Business purpose</label>
          <input
            id="business-purpose"
            name="businessPurpose"
            className="input"
            placeholder="Why the store needed this purchase"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="item-details">
            Known items and quantities{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="item-details"
            name="itemDetails"
            className="textarea"
            placeholder="Example: 6 gallons whole milk at $3.99 each"
          />
          <p className="field-help">
            This text does not change inventory automatically. Item quantities
            require a structured line and owner approval.
          </p>
        </div>

        <div className="callout">
          <AlertTriangle size={18} />
          <span>
            A bank charge proves that money moved, but not what was purchased.
            This entry remains visibly marked as missing evidence.
          </span>
        </div>

        {message ? (
          <p
            role="status"
            className={
              status === "error"
                ? "text-sm text-red-700"
                : "flex items-center gap-2 text-sm text-lime-700"
            }
          >
            {status === "saved" ? <CheckCircle2 size={17} /> : null}
            {message}
          </p>
        ) : null}

        <button
          className="button button-primary"
          type="submit"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : null}
          {status === "submitting" ? "Saving…" : "Save for owner review"}
        </button>
      </div>
    </form>
  );
}
