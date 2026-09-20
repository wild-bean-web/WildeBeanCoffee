import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ReceiptCapture } from "@/components/receipt-capture";
import { requireCapability } from "@/lib/auth/session";
import { activeLocationName } from "@/services/locations/scope";

export default async function CapturePurchasePage() {
  const session = await requireCapability("purchase:capture");
  const locationName = activeLocationName(session);

  return (
    <>
      <PageHeader
        eyebrow="Quick capture"
        title="Save the receipt before it disappears"
        description={
          locationName
            ? `This file is stored on ${locationName}'s books only. Switch locations before uploading for another location.`
            : "Take one clear photo. Known vendors and products will be mapped automatically; the review queue asks only about exceptions."
        }
        actions={
          <Link href="/purchases/manual" className="button">
            No receipt available
          </Link>
        }
      />
      <ReceiptCapture />
    </>
  );
}
