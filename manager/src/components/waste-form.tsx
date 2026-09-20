"use client";

import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

interface InventoryProductOption {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unitSymbol: string;
}

const reasons = [
  ["spoilage", "Spoilage"],
  ["remake", "Remake"],
  ["staff_meal", "Staff meal"],
  ["donation", "Donation"],
  ["breakage", "Breakage"],
  ["unsold_pastry", "Unsold pastry"],
  ["other", "Other"],
] as const;

interface WasteFormProps {
  products: InventoryProductOption[];
}

export function WasteForm({ products }: WasteFormProps) {
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
      productId: form.get("productId"),
      quantity: form.get("quantity"),
      reason: form.get("reason"),
      note: form.get("note") || undefined,
    };

    try {
      const response = await fetch("/api/inventory/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        data?: { wentNegative: boolean };
        error?: { message: string };
      };
      if (!response.ok || !result.data) {
        throw new Error(result.error?.message ?? "Waste was not recorded.");
      }
      setStatus("saved");
      setMessage(
        result.data.wentNegative
          ? "Waste recorded. On-hand is now negative and needs a recount."
          : "Waste recorded as a known depletion, separate from COGS.",
      );
      formElement.reset();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Waste was not recorded.",
      );
    }
  }

  if (products.length === 0) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Record waste</h2>
            <p>Known waste explains variance and is never subtracted twice.</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="callout">
            <AlertTriangle size={18} />
            <span>
              Products must be reviewed into the catalog before waste can be
              posted to the inventory ledger.
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-header">
        <div>
          <h2>Record waste</h2>
          <p>Spoilage, remakes, staff meals, donations, and unsold pastry.</p>
        </div>
      </div>
      <div className="panel-body form-grid">
        <div className="form-grid form-grid-two">
          <div className="field">
            <label htmlFor="waste-product">Product</label>
            <select id="waste-product" name="productId" className="input" required>
              <option value="">Select a product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.unitSymbol})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="waste-quantity">Quantity wasted</label>
            <input
              id="waste-quantity"
              name="quantity"
              className="input"
              type="number"
              inputMode="decimal"
              min="0.000001"
              step="any"
              required
            />
          </div>
        </div>
        <div className="form-grid form-grid-two">
          <div className="field">
            <label htmlFor="waste-reason">Reason</label>
            <select id="waste-reason" name="reason" className="input" required>
              {reasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="waste-note">Note (optional)</label>
            <input id="waste-note" name="note" className="input" maxLength={500} />
          </div>
        </div>
        <button className="button button-primary" type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          Post waste
        </button>
        {message ? (
          <p className={`text-sm ${status === "error" ? "text-red-700" : "text-muted"}`}>
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
