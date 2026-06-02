"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "cookieNoticeAccepted";

export default function CookieNotice() {
  const [accepted, setAccepted] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setAccepted(stored === "true");
    } catch {
      setAccepted(false);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
      setAccepted(true);
    } catch {
      setAccepted(true);
    }
  };

  // Don't render until we've read localStorage (avoids hydration mismatch)
  if (accepted === null) return null;

  return (
    <AnimatePresence>
      {!accepted && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "tween", duration: 0.3 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--coffee-brown-light)] bg-[var(--coffee-brown)] text-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
        >
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
            <p className="text-center text-sm sm:text-left">
              We use cookies and collect data as described in our{" "}
              <Link
                href="/privacy"
                className="font-medium text-[var(--lime-green-light)] underline hover:text-[var(--lime-green)]"
              >
                Privacy Policy
              </Link>
              . By continuing, you agree to this use.
            </p>
            <button
              type="button"
              onClick={handleAccept}
              aria-label="Accept cookies and continue"
              className="shrink-0 rounded-lg bg-[var(--lime-green)] px-4 py-2 text-sm font-semibold text-[var(--coffee-brown)] transition-colors hover:bg-[var(--lime-green-light)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green-light)] focus:ring-offset-2 focus:ring-offset-[var(--coffee-brown)]"
            >
              Accept
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
