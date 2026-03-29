"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Lottie from "lottie-react";
import { loyaltyApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  getStampImageSrc,
  LOYALTY_STAMPS_PER_REWARD,
  LOYALTY_QUALIFY_MIN_TOTAL,
  LOYALTY_FREE_ITEM_MAX_PRE_TAX,
  REWARD_ASSETS,
} from "@/lib/loyaltyConstants";
import BeanStampSlotPlaceholder from "@/components/BeanStampSlotPlaceholder";

export default function RewardsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loyalty, setLoyalty] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [confetti, setConfetti] = useState(null);

  useEffect(() => {
    fetch(REWARD_ASSETS.confetti)
      .then((r) => r.json())
      .then(setConfetti)
      .catch(() => setConfetti(null));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    loyaltyApi
      .getMe()
      .then(setLoyalty)
      .catch((e) => setLoadError(e.message || "Could not load rewards"));
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-[var(--coffee-brown)]">
            Bean Stamps
          </h1>
          <p className="mt-4 text-gray-600">
            Sign in to see your stamps and earn rewards on online orders.
          </p>
          <Link
            href="/auth"
            className="mt-6 inline-block rounded-full bg-[var(--lime-green)] px-6 py-3 font-semibold text-white hover:bg-[var(--lime-green-dark)]"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const stamps = loyalty?.stamps ?? 0;
  const rewardReady = loyalty?.rewardReady ?? false;
  const displayCount = rewardReady
    ? LOYALTY_STAMPS_PER_REWARD
    : Math.min(stamps, LOYALTY_STAMPS_PER_REWARD);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--coffee-brown-very-light)] to-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/order"
            className="text-sm font-medium text-[var(--coffee-brown)] underline"
          >
            ← Back to checkout
          </Link>
          <Link
            href="/rewards/terms"
            className="text-sm font-medium text-[var(--coffee-brown)] underline"
          >
            Program terms
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-[var(--coffee-brown)]">
          Bean Stamps
        </h1>
        <p className="mt-2 text-gray-600">
          Online only. Spend at least ${LOYALTY_QUALIFY_MIN_TOTAL} after tax per
          qualifying order to earn one stamp. At {LOYALTY_STAMPS_PER_REWARD}{" "}
          stamps, apply up to ${LOYALTY_FREE_ITEM_MAX_PRE_TAX} off one cart line
          at checkout.
        </p>

        {loadError && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {loadError}
          </p>
        )}

        {rewardReady && confetti && (
          <div className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center">
            <div className="h-64 w-full max-w-2xl">
              <Lottie animationData={confetti} loop={false} />
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-lg">
          {rewardReady ? (
            <div className="text-center">
              <p className="text-xl font-bold text-[var(--lime-green-dark)]">
                You have a reward ready!
              </p>
              <p className="mt-2 text-gray-600">
                Go to checkout and tap Apply free item reward on one line (max $
                {LOYALTY_FREE_ITEM_MAX_PRE_TAX} pre-tax). Your stamp progress
                resets when you place that order.
              </p>
            </div>
          ) : stamps === 0 ? (
            <div className="flex flex-col items-center text-center">
              <Image
                src={REWARD_ASSETS.emptyState}
                alt=""
                width={200}
                height={200}
                className="mb-4"
                unoptimized
              />
              <p className="font-semibold text-[var(--coffee-brown)]">
                Start your collection
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Your first stamp appears after your first qualifying online order.
              </p>
            </div>
          ) : null}

          <div className="mt-8">
            <p className="mb-4 text-center text-sm font-semibold text-[var(--coffee-brown)]">
              {rewardReady
                ? "Full card — redeem at checkout!"
                : `${displayCount} / ${LOYALTY_STAMPS_PER_REWARD} stamps`}
            </p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-5 md:gap-3">
              {Array.from({ length: LOYALTY_STAMPS_PER_REWARD }, (_, i) => {
                const n = i + 1;
                const earned = n <= displayCount;
                return (
                  <div
                    key={n}
                    className={`flex aspect-square items-center justify-center rounded-xl border-2 p-1.5 ${
                      earned
                        ? "border-[var(--lime-green)] bg-[var(--lime-green-light)]/50 shadow-sm"
                        : "border-dashed border-gray-300 bg-stone-50/90"
                    }`}
                  >
                    {earned ? (
                      <Image
                        src={getStampImageSrc(n)}
                        alt={`Stamp ${n} earned`}
                        width={64}
                        height={64}
                        className="h-auto w-full object-contain"
                        unoptimized
                      />
                    ) : (
                      <BeanStampSlotPlaceholder />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => router.push("/order")}
              className="rounded-full bg-[var(--lime-green)] px-8 py-3 font-semibold text-white hover:bg-[var(--lime-green-dark)]"
            >
              Order online
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
