"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ordersApi } from "@/lib/api";
import { clearPostCheckoutClientState } from "@/lib/checkoutClientState";
import { PICKUP_COFFEE_FRESHNESS_NOTE } from "@/lib/pickupCoffeeFreshnessNote";

/** Clover may leave this literal in successUrl if redirect template is not substituted. */
const UNRESOLVED_CHECKOUT_SESSION_PLACEHOLDER = "{CHECKOUT_SESSION_ID}";

const SHOP_CONTACT_EMAIL = "info@wildbeancoffeeshop.com";

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
  const [showPickupCoffeeFreshnessNote, setShowPickupCoffeeFreshnessNote] =
    useState(false);

  useEffect(() => {
    const completeOrder = async () => {
      const pendingRaw = sessionStorage.getItem("pendingOrder");

      if (pendingRaw) {
        let orderData;
        try {
          orderData = JSON.parse(pendingRaw);
        } catch {
          setError(
            "We could not read your saved order in this browser. If you completed payment, please email the shop so we can locate your order.",
          );
          setLoading(false);
          return;
        }

        setShowPickupCoffeeFreshnessNote(
          Boolean(orderData.pickupUiHints?.showCoffeeFreshnessNote),
        );

        const urlCheckoutRaw = (checkoutId || "").trim();
        const urlCheckout =
          urlCheckoutRaw &&
          urlCheckoutRaw !== UNRESOLVED_CHECKOUT_SESSION_PLACEHOLDER
            ? urlCheckoutRaw
            : "";
        const storedCheckout =
          orderData.checkoutId != null
            ? String(orderData.checkoutId).trim()
            : "";
        const resolvedCheckoutId = urlCheckout || storedCheckout;

        if (!resolvedCheckoutId) {
          setError(
            "We could not link this page to your checkout. If you were charged, please call or email the shop with the time of payment and the cardholder name so we can find your order.",
          );
          setLoading(false);
          return;
        }

        setSessionRefForDisplay(resolvedCheckoutId);

        try {
          // Use server draft + recover only: avoids rolling minimum-lead pickup checks
          // against wall-clock after the customer spends time on Clover, and matches webhook data.
          const result = await withRetries(() =>
            ordersApi.recoverHostedCheckout(resolvedCheckoutId),
          );

          setOrderId(result._id);
          clearPostCheckoutClientState();

          try {
            await fetch("/api/payments/print-receipt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: result._id }),
            });
          } catch (printError) {
            console.error("Receipt printing failed:", printError);
          }
        } catch (err) {
          console.error("Error creating / recovering order:", err);
          setError(
            err.message ||
              "We could not finalize your order in our system after payment. Please call or email the shop right away; do not place the same order again until someone has helped you.",
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
          clearPostCheckoutClientState();
          try {
            await fetch("/api/payments/print-receipt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: result._id }),
            });
          } catch (printError) {
            console.error("Receipt printing failed:", printError);
          }
        } catch (err) {
          console.error("Recover hosted checkout failed:", err);
          setError(
            err.message ||
              "We could not load your order in this browser after payment. Please call or email the shop so we can confirm your order.",
          );
        } finally {
          setLoading(false);
        }
        return;
      }

      setError(
        "No order information was found in this browser. If you already paid, please call or email the shop with your name and payment time so we can locate your order.",
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
                We Need to Help You Finish This
              </h1>
              <p className="text-gray-600">{error}</p>
              {(sessionRefForDisplay || checkoutId) && (
                <p className="mt-4 text-sm text-gray-500">
                  Reference for the shop (if you were sent here after paying):{" "}
                  {sessionRefForDisplay || checkoutId}
                </p>
              )}
              <p className="mt-4 text-sm text-gray-600">
                Email us at{" "}
                <a
                  className="font-medium text-[var(--coffee-brown)] underline"
                  href={`mailto:${SHOP_CONTACT_EMAIL}`}
                >
                  {SHOP_CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <a
                href={`mailto:${SHOP_CONTACT_EMAIL}?subject=Online order help`}
                className="rounded-full bg-[var(--lime-green)] px-6 py-3 text-center text-white font-semibold transition-colors hover:bg-[var(--lime-green-dark)]"
              >
                Email the shop
              </a>
              <Link
                href="/shop"
                className="rounded-full border-2 border-[var(--coffee-brown)] px-6 py-3 text-center text-[var(--coffee-brown)] font-semibold transition-colors hover:bg-gray-50"
              >
                Continue shopping
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
            {showPickupCoffeeFreshnessNote && (
              <p className="mx-auto mb-4 max-w-md text-sm leading-snug text-stone-600">
                {PICKUP_COFFEE_FRESHNESS_NOTE}
              </p>
            )}
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
