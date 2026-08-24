"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import ConfirmAlert from "@/components/ConfirmAlert";

const ConfirmAlertContext = createContext(null);

/**
 * Show a confirmation dialog anywhere in the app:
 *
 *   const confirmAlert = useConfirmAlert();
 *   const ok = await confirmAlert({
 *     title: "Mark out of stock?",
 *     message: "Customers won't be able to order this item online.",
 *     confirmLabel: "Mark out of stock",
 *     variant: "warning",
 *   });
 *   if (!ok) return;
 */
export function ConfirmAlertProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirmAlert = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({
        title: options.title ?? "Confirm",
        message: options.message ?? "",
        confirmLabel: options.confirmLabel ?? "Confirm",
        cancelLabel: options.cancelLabel ?? "Cancel",
        variant: options.variant ?? "default",
      });
    });
  }, []);

  const finish = useCallback((result) => {
    setDialog(null);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(result);
  }, []);

  return (
    <ConfirmAlertContext.Provider value={confirmAlert}>
      {children}
      <ConfirmAlert
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={dialog?.cancelLabel}
        variant={dialog?.variant}
        onConfirm={() => finish(true)}
        onCancel={() => finish(false)}
      />
    </ConfirmAlertContext.Provider>
  );
}

export function useConfirmAlert() {
  const confirmAlert = useContext(ConfirmAlertContext);
  if (!confirmAlert) {
    throw new Error(
      "useConfirmAlert must be used within a ConfirmAlertProvider",
    );
  }
  return confirmAlert;
}
