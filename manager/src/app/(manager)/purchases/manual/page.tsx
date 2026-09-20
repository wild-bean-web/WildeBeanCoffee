import { PageHeader } from "@/components/page-header";
import { ManualPurchaseForm } from "@/components/manual-purchase-form";
import { requireCapability } from "@/lib/auth/session";
import { activeLocationName } from "@/services/locations/scope";

export default async function ManualPurchasePage() {
  const session = await requireCapability("purchase:capture");
  const locationName = activeLocationName(session);

  return (
    <>
      <PageHeader
        eyebrow="Missing receipt"
        title="Record a purchase manually"
        description={
          locationName
            ? `Manual drafts post to ${locationName} only and stay marked as missing evidence.`
            : "The record will be useful for card reconciliation and expenses, but it stays marked as missing evidence and cannot invent inventory detail."
        }
      />
      <ManualPurchaseForm />
    </>
  );
}
