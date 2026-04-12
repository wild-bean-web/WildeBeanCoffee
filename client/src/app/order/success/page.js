"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ordersApi } from "@/lib/api";
import { getPickupLeadTimeErrorFromIso } from "@/lib/pickupValidation";
import { BEAN_STAMPS_ENABLED } from "@/lib/loyaltyConstants";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetries(fn, { tries = 3, baseMs = 700 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(baseMs * (i + 1));
    }
  }
  throw lastErr;
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const checkoutId = searchParams.get("checkoutId");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [sessionRefForDisplay, setSessionRefForDisplay] = useState(null);

  useEffect(() => {
    const completeOrder = async () => {
      const pendingRaw = sessionStorage.getItem("pendingOrder");

      if (pendingRaw) {
        let orderData;
        try {
          orderData = JSON.parse(pendingRaw);
        } catch {
          setError("Saved order data was invalid. Try recover below or contact support.");
          setLoading(false);
          return;
        }

        const leadErr = getPickupLeadTimeErrorFromIso(orderData.pickupTime);
        if (leadErr) {
          setError(leadErr);
          setLoading(false);
          return;
        }

        const urlCheckout = (checkoutId || "").trim();
        const storedCheckout =
          orderData.checkoutId != null
            ? String(orderData.checkoutId).trim()
            : "";
        const resolvedCheckoutId = urlCheckout || storedCheckout;

        if (!resolvedCheckoutId) {
          setError(
            "Could not determine your checkout session (missing from this page and saved data). If you were charged, contact the shop with your email and payment time.",
          );
          setLoading(false);
          return;
        }

        setSessionRefForDisplay(resolvedCheckoutId);

        try {
          const { checkoutId: _omit, ...rest } = orderData;
          const orderPayload = {
            ...rest,
            paymentStatus: "paid",
            paymentRef: resolvedCheckoutId,
          };
          if (!BEAN_STAMPS_ENABLED) {
            delete orderPayload.beanStampsRedeemCartKey;
          }

          let result;
          try {
            result = await withRetries(() => ordersApi.create(orderPayload));
          } catch (createErr) {
            console.error("Error creating order (will try recover):", createErr);
            result = await withRetries(() =>
              ordersApi.recoverHostedCheckout(resolvedCheckoutId),
            );
          }

          setOrderId(result._id);
          sessionStorage.removeItem("pendingOrder");

          try {
            await fetch("/api/payments/print-receipt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: result._id }),
            });
          } catch (printError) {
            console.error("Receipt printing failed:", printError);
          }
          localStorage.removeItem("cart");
        } catch (err) {
          console.error("Error creating / recovering order:", err);
          setError(
            `${err.message || "Payment may have succeeded, but we could not finalize your order."} Checkout session: ${resolvedCheckoutId}. Please contact the shop with this reference.`,
          );
        } finally {
          setLoading(false);
        }
        return;
      }

      if (checkoutId) {
        const ref = checkoutId.trim();
        setSessionRefForDisplay(ref);
        try {
          const result = await withRetries(() =>
            ordersApi.recoverHostedCheckout(ref),
          );
          setOrderId(result._id);
          try {
            await fetch("/api/payments/print-receipt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: result._id }),
            });
          } catch (printError) {
            console.error("Receipt printing failed:", printError);
          }
          localStorage.removeItem("cart");
        } catch (err) {
          console.error("Recover hosted checkout failed:", err);
          setError(
            err.message ||
              "Your payment may have gone through, but we could not load your order in this browser. Check with the shop or contact support.",
          );
        } finally {
          setLoading(false);
        }
        return;
      }

      setError(
        "No order data found in this browser. If you paid, your order may still be processing — contact support with your payment confirmation.",
      );
      setLoading(false);
    };

    completeOrder();
  }, [checkoutId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--lime-green)] border-r-transparent"></div>
          <p className="text-gray-600">Processing your order...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
                Order Processing Error
              </h1>
              <p className="text-gray-600">{error}</p>
              {(sessionRefForDisplay || checkoutId) && (
                <p className="mt-4 text-sm text-gray-500">
                  Payment session: {sessionRefForDisplay || checkoutId}
                </p>
              )}
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg bg-white p-8 text-center shadow-lg"
        >
          <div className="mb-6">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--lime-green)]">
                <svg
                  className="h-8 w-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h1 className="mb-2 text-3xl font-bold text-[var(--coffee-brown)]">
              Order Placed Successfully!
            </h1>
            <p className="mb-4 text-gray-600">
              Thank you for your order. We&apos;ll have it ready for pickup soon.
            </p>
            {orderId && (
              <p className="text-sm text-gray-500">
                Order ID: {orderId.slice(-8)}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/shop"
              className="rounded-full bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-colors hover:bg-[var(--lime-green-dark)]"
            >
              Continue Shopping
            </Link>
            <Link
              href="/menu"
              className="rounded-full border-2 border-[var(--coffee-brown)] px-6 py-3 text-[var(--coffee-brown)] font-semibold transition-colors hover:bg-gray-50"
            >
              View Menu
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--lime-green)] border-r-transparent"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
