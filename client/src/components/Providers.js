"use client";

import { ConfirmAlertProvider } from "@/context/ConfirmAlertContext";

export default function Providers({ children }) {
  return <ConfirmAlertProvider>{children}</ConfirmAlertProvider>;
}
