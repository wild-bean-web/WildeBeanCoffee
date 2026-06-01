import { PICKUP_ARRIVAL_NOTE } from "@/lib/pickupCoffeeFreshnessNote";

/** Pickup check-in reminder for checkout, confirmation, and order history. */
export default function PickupArrivalNotice({ className = "" }) {
  return (
    <p
      role="note"
      className={`rounded-lg border border-[var(--lime-green)]/40 bg-[var(--lime-green)]/10 px-3 py-2.5 text-sm leading-relaxed text-[var(--coffee-brown)] ${className}`.trim()}
    >
      {PICKUP_ARRIVAL_NOTE}
    </p>
  );
}
