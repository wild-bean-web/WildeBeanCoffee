"use client";

import { useState } from "react";

type BillingStatus = "included" | "trialing" | "active" | "past_due" | "canceled" | "unpaid";

export interface LocationBillingRow {
  id: string;
  name: string;
  status: BillingStatus;
  checkoutReady: boolean;
}

const labels: Record<BillingStatus, string> = {
  included: "Included",
  trialing: "Trial",
  active: "Paid",
  past_due: "Payment due",
  canceled: "Canceled",
  unpaid: "Unpaid",
};

export function LocationBillingList({ locations }: { locations: LocationBillingRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function pay(locationId: string) {
    setPendingId(locationId);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      const result = (await response.json()) as {
        data?: { url: string };
        error?: { message: string };
      };
      if (!response.ok || !result.data?.url) {
        throw new Error(result.error?.message ?? "Checkout could not be opened.");
      }
      window.location.assign(result.data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout could not be opened.");
      setPendingId(null);
    }
  }

  return (
    <div className="panel-body">
      <ul className="exception-list">
        {locations.map((location) => (
          <li key={location.id}>
            <div className="billing-row">
              <div>
                <strong>{location.name}</strong>
                <span>{labels[location.status]}</span>
              </div>
              {location.status !== "included" && location.status !== "active" ? (
                <button
                  className="button button-accent"
                  type="button"
                  disabled={!location.checkoutReady || pendingId === location.id}
                  onClick={() => void pay(location.id)}
                >
                  {location.checkoutReady ? "Pay for this location" : "Billing not connected"}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
