"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  BEAN_STAMPS_ENABLED,
  LOYALTY_STAMPS_PER_REWARD,
  LOYALTY_QUALIFY_MIN_TOTAL,
  REWARD_ASSETS,
  getLoyaltyRewardTaglineMidSentence,
  getStampImageSrc,
} from "@/lib/loyaltyConstants";
import { useAuth } from "@/hooks/useAuth";

const STAMP_PREVIEW = [1, 6, 12, 20];

/**
 * Loyalty program promo — only when Bean Stamps is enabled (matches server).
 * @param {"home" | "menu" | "checkout"} variant
 */
export default function BeanStampsPromo({ variant = "menu" }) {
  const { user } = useAuth();

  if (!BEAN_STAMPS_ENABLED) return null;

  const joinHref = "/auth?signup=1";
  const cardHref = "/rewards";

  if (variant === "home") {
    return (
      <section
        className="relative overflow-hidden bg-gradient-to-br from-[var(--lime-green-light)]/90 via-white to-amber-50/60 py-14 px-4 sm:px-6 lg:px-8"
        aria-labelledby="bean-stamps-home-heading"
      >
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--lime-green)]/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[var(--coffee-brown)]/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:gap-12 lg:text-left">
            <div className="mb-8 flex shrink-0 justify-center gap-2 sm:gap-3 lg:mb-0">
              {STAMP_PREVIEW.map((n, i) => (
                <motion.div
                  key={n}
                  initial={{ opacity: 0, y: 12, rotate: -6 + i * 4 }}
                  whileInView={{ opacity: 1, y: 0, rotate: -6 + i * 4 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.45 }}
                  className="drop-shadow-md"
                >
                  <Image
                    src={getStampImageSrc(n)}
                    alt=""
                    width={56}
                    height={56}
                    className="h-12 w-12 sm:h-14 sm:w-14"
                    unoptimized
                  />
                </motion.div>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--coffee-brown)]/70">
                Now live
              </p>
              <h2
                id="bean-stamps-home-heading"
                className="text-3xl font-bold text-[var(--coffee-brown)] sm:text-4xl"
              >
                Bean Stamps — your online rewards perk
              </h2>
              <p className="mt-3 text-base text-[var(--coffee-brown)]/85 sm:text-lg">
                Order online, earn stamps on qualifying orders (${LOYALTY_QUALIFY_MIN_TOTAL}+ after tax), and
                when you fill your card with {LOYALTY_STAMPS_PER_REWARD} stamps, enjoy a{" "}
                <span className="font-semibold text-[var(--lime-green-dark)]">
                  free drink or bowl
                </span>{" "}
                ({getLoyaltyRewardTaglineMidSentence()}). Same Wild Bean vibe — now with perks.
              </p>
              <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:justify-start">
                {user ? (
                  <Link
                    href={cardHref}
                    className="inline-flex items-center justify-center rounded-full bg-[var(--lime-green)] px-6 py-3 text-center text-sm font-bold text-white shadow-md transition hover:bg-[var(--lime-green-dark)] hover:shadow-lg"
                  >
                    View my Bean Stamps
                  </Link>
                ) : (
                  <>
                    <Link
                      href={joinHref}
                      className="inline-flex items-center justify-center rounded-full bg-[var(--lime-green)] px-6 py-3 text-center text-sm font-bold text-white shadow-md transition hover:bg-[var(--lime-green-dark)] hover:shadow-lg"
                    >
                      Join free &amp; start earning
                    </Link>
                    <Link
                      href={cardHref}
                      className="inline-flex items-center justify-center rounded-full border-2 border-[var(--coffee-brown)] bg-white px-6 py-3 text-center text-sm font-bold text-[var(--coffee-brown)] transition hover:bg-[var(--coffee-brown)] hover:text-white"
                    >
                      How it works
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "checkout") {
    if (user) return null;
    return (
      <div
        className="mb-6 rounded-2xl border-2 border-[var(--lime-green)]/40 bg-gradient-to-r from-[var(--lime-green-light)]/50 via-white to-amber-50/40 p-4 shadow-sm sm:p-5"
        role="region"
        aria-label="Bean Stamps rewards program"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3 sm:gap-4">
            <div className="flex shrink-0 -space-x-2" aria-hidden>
              {STAMP_PREVIEW.slice(0, 3).map((n) => (
                <Image
                  key={n}
                  src={getStampImageSrc(n)}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border-2 border-white shadow-sm"
                  unoptimized
                />
              ))}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--coffee-brown)]/60">
                New — Bean Stamps
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--coffee-brown)] sm:text-base">
                Earn stamps on online orders. At {LOYALTY_STAMPS_PER_REWARD} stamps,{" "}
                {getLoyaltyRewardTaglineMidSentence()}.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href={joinHref}
              className="inline-flex items-center justify-center rounded-full bg-[var(--lime-green)] px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-[var(--lime-green-dark)]"
            >
              Sign up free
            </Link>
            <Link
              href="/auth"
              className="text-center text-sm font-semibold text-[var(--coffee-brown)] underline underline-offset-2 hover:text-[var(--lime-green-dark)]"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* menu */
  return (
    <div
      className="mb-6 rounded-2xl border-2 border-dashed border-[var(--lime-green)]/50 bg-white/90 p-4 shadow-sm sm:p-5"
      role="region"
      aria-label="Bean Stamps rewards"
    >
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--lime-green)] p-1.5"
            aria-hidden
          >
            <Image
              src={REWARD_ASSETS.applyReward}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              unoptimized
            />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--lime-green-dark)]">
              Bean Stamps rewards
            </p>
            <p className="mt-1 text-sm text-[var(--coffee-brown)] sm:text-base">
              {user ? (
                <>
                  You&apos;re earning on qualifying orders.{" "}
                  <span className="font-semibold">
                    {LOYALTY_STAMPS_PER_REWARD} stamps
                  </span>{" "}
                  = {getLoyaltyRewardTaglineMidSentence()}.
                </>
              ) : (
                <>
                  <span className="font-semibold">New:</span> create a free account and earn stamps when you
                  order online (${LOYALTY_QUALIFY_MIN_TOTAL}+ after tax). Fill the card for a treat on us.
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {user ? (
            <Link
              href={cardHref}
              className="inline-flex items-center justify-center rounded-full bg-[var(--coffee-brown)] px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-[var(--coffee-brown-dark)]"
            >
              Open rewards card
            </Link>
          ) : (
            <>
              <Link
                href={joinHref}
                className="inline-flex items-center justify-center rounded-full bg-[var(--lime-green)] px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-[var(--lime-green-dark)]"
              >
                Join free
              </Link>
              <Link
                href={cardHref}
                className="inline-flex items-center justify-center rounded-full border-2 border-[var(--coffee-brown)] px-5 py-2.5 text-center text-sm font-bold text-[var(--coffee-brown)] transition hover:bg-[var(--coffee-brown)] hover:text-white"
              >
                Learn more
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
