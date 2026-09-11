"use client";

import { ConfirmAlertProvider } from "@/context/ConfirmAlertContext";
import KitchenOrderAlertHost from "@/components/KitchenOrderAlertHost";

export default function Providers({ children }) {
  return (
    <ConfirmAlertProvider>
      {children}
      <KitchenOrderAlertHost />
    </ConfirmAlertProvider>
  );
}
