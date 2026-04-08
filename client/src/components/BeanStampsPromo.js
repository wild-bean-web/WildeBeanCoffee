"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  BEAN_STAMPS_ENABLED,
  LOYALTY_STAMPS_PER_REWARD,
  REWARD_ASSETS,
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
                Create a free account and earn stamps on qualifying online orders. At{" "}
                {LOYALTY_STAMPS_PER_REWARD} stamps, receive your rewards.
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
              <p className="mt-4 text-center text-xs text-[var(--coffee-brown)]/65 sm:text-left lg:text-left">
                <Link
                  href="/rewards/terms"
                  className="font-medium underline underline-offset-2 hover:text-[var(--lime-green-dark)]"
                >
                  See program terms
                </Link>
              </p>
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
        className="mb-6 rounded-2xl border-2 border-[var(--lime-green)]/40 bg-gradient-to-r from-[var(--lime-green-light)]/50 via-white to-amber-50/40 p-5 shadow-sm sm:p-6"
        role="region"
        aria-label="Bean Stamps rewards program"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="flex min-w-0 gap-3 sm:gap-4 lg:flex-1">
            <div className="flex shrink-0 -space-x-2 self-start pt-0.5" aria-hidden>
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
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--coffee-brown)]/60">
                New — Bean Stamps
              </p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[var(--coffee-brown)] sm:text-base lg:pr-4">
                Create a free account and earn stamps on qualifying online orders. At{" "}
                {LOYALTY_STAMPS_PER_REWARD} stamps, receive your rewards.
              </p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-4 border-t border-[var(--coffee-brown)]/10 pt-5 sm:gap-3 sm:border-t-0 sm:pt-0 lg:w-auto lg:max-w-[20rem] lg:items-end lg:self-start">
            <Link
              href={joinHref}
              className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-full bg-[var(--lime-green)] px-6 text-center text-sm font-bold text-white transition hover:bg-[var(--lime-green-dark)] lg:min-h-0 lg:w-auto lg:px-7 lg:py-3"
            >
              Sign up free
            </Link>
            <Link
              href="/auth"
              className="px-0.5 text-center text-xs font-medium leading-relaxed text-[var(--coffee-brown)] underline decoration-[var(--coffee-brown)]/35 underline-offset-[5px] transition hover:text-[var(--lime-green-dark)] sm:text-sm sm:font-semibold lg:text-right"
            >
              Already have an account? Sign in
            </Link>
            <p className="px-0.5 text-center text-[0.7rem] leading-relaxed text-[var(--coffee-brown)]/55 lg:text-right">
              <Link
                href="/rewards/terms"
                className="font-medium underline underline-offset-2 hover:text-[var(--lime-green-dark)]"
              >
                See program terms
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* menu */
  return (
    <div
      className="mb-6 rounded-2xl border-2 border-dashed border-[var(--lime-green)]/50 bg-white/90 p-5 shadow-sm sm:p-6"
      role="region"
      aria-label="Bean Stamps rewards"
    >
      <div className="flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:gap-8">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:pr-2">
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
            <p className="mt-1 text-sm leading-relaxed text-[var(--coffee-brown)] sm:text-base">
              {user ? (
                <>
                  You&apos;re earning stamps on qualifying online orders. At{" "}
                  <span className="font-semibold">{LOYALTY_STAMPS_PER_REWARD} stamps</span>, receive your rewards.
                </>
              ) : (
                <>
                  <span className="font-semibold">New:</span> create a free account and earn stamps on qualifying
                  online orders. At {LOYALTY_STAMPS_PER_REWARD} stamps, receive your rewards.
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mt-5 flex w-full min-w-0 flex-col gap-3 border-t border-[var(--coffee-brown)]/10 pt-5 sm:mt-0 sm:w-auto sm:shrink-0 sm:border-t-0 sm:pt-0 sm:pl-2 md:pl-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:justify-end sm:gap-3">
            {user ? (
              <Link
                href={cardHref}
                className="inline-flex min-h-[2.875rem] w-full items-center justify-center whitespace-nowrap rounded-full bg-[var(--coffee-brown)] px-6 py-2.5 text-center text-sm font-bold text-white transition hover:bg-[var(--coffee-brown-dark)] sm:w-auto sm:min-h-[2.75rem]"
              >
                Open rewards card
              </Link>
            ) : (
              <>
                <Link
                  href={joinHref}
                  className="inline-flex min-h-[2.875rem] w-full flex-1 items-center justify-center whitespace-nowrap rounded-full bg-[var(--lime-green)] px-6 py-2.5 text-center text-sm font-bold leading-none text-white transition hover:bg-[var(--lime-green-dark)] sm:w-auto sm:min-h-[2.75rem] sm:flex-initial"
                >
                  Join free
                </Link>
                <Link
                  href={cardHref}
                  className="inline-flex min-h-[2.875rem] w-full flex-1 items-center justify-center whitespace-nowrap rounded-full border-2 border-[var(--coffee-brown)] bg-white px-6 py-2.5 text-center text-sm font-bold leading-none text-[var(--coffee-brown)] transition hover:bg-[var(--coffee-brown)] hover:text-white sm:w-auto sm:min-h-[2.75rem] sm:flex-initial"
                >
                  Learn more
                </Link>
              </>
            )}
          </div>
          <p className="text-center text-[0.7rem] leading-relaxed text-[var(--coffee-brown)]/60 sm:text-right">
            <Link href="/rewards/terms" className="underline underline-offset-2 hover:text-[var(--lime-green-dark)]">
              See program terms
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
