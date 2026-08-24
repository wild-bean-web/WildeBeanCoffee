"use client";

import { motion, AnimatePresence } from "framer-motion";

const CONFIRM_BUTTON_CLASS = {
  default:
    "bg-[var(--coffee-brown)] hover:bg-[var(--coffee-brown-dark)] text-white",
  warning:
    "bg-amber-600 hover:bg-amber-700 text-white",
  success:
    "bg-[var(--lime-green)] hover:opacity-90 text-white",
};

/**
 * Reusable confirmation dialog — message, labels, and confirm action are passed in by the caller.
 */
export default function ConfirmAlert({
  open,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}) {
  const confirmClass =
    CONFIRM_BUTTON_CLASS[variant] || CONFIRM_BUTTON_CLASS.default;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Dismiss dialog backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCancel}
            className="fixed inset-0 z-[9998] cursor-default bg-black/50"
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-alert-title"
            aria-describedby="confirm-alert-message"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 z-[9999] w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="confirm-alert-title"
              className="text-lg font-semibold text-gray-900"
            >
              {title}
            </h2>
            <p
              id="confirm-alert-message"
              className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600"
            >
              {message}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${confirmClass}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
