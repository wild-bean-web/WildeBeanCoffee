"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export default function OrderFailurePage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Payment processing failed";

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg bg-white p-8 text-center shadow-lg"
        >
          <div className="mb-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-[var(--coffee-brown)]">
              Payment Failed
            </h1>
            <p className="text-gray-600">{error}</p>
            <p className="mt-4 text-sm text-gray-500">
              Please check your payment information and try again.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/order"
              className="rounded-full bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-colors hover:bg-[var(--lime-green-dark)]"
            >
              Try Again
            </Link>
            <Link
              href="/shop"
              className="rounded-full border-2 border-[var(--coffee-brown)] px-6 py-3 text-[var(--coffee-brown)] font-semibold transition-colors hover:bg-gray-50"
            >
              Continue Shopping
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

