import { notFound } from "next/navigation";
import { BEAN_STAMPS_ENABLED } from "@/lib/loyaltyConstants";

export default function RewardsLayout({ children }) {
  if (!BEAN_STAMPS_ENABLED) notFound();
  return children;
}
