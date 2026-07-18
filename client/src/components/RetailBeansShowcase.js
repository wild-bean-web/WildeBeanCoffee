"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  RETAIL_YIRGACHEFFE,
  formatRetailPrice,
} from "@/lib/retailBeans";

/**
 * Retail whole-bean showcase — home (editorial split) or shop (featured banner).
 * @param {"home" | "shop"} variant
 */
export default function RetailBeansShowcase({ variant = "home" }) {
  const bean = RETAIL_YIRGACHEFFE;
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const mediaY = useTransform(scrollYProgress, [0, 1], [28, -28]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.4, 0.8], [0.2, 0.55, 0.25]);

  const productImage = (
    <Image
      src={bean.image}
      alt={`${bean.name} coffee bag label`}
      fill
      className="object-contain object-center p-3 sm:p-4"
      sizes="(max-width: 1024px) 100vw, 40vw"
      unoptimized
      priority={variant === "home"}
    />
  );

  if (variant === "shop") {
    return (
      <section
        className="relative overflow-hidden border-b border-[var(--coffee-brown)]/10 bg-[var(--coffee-brown-very-light)]"
        aria-labelledby="retail-beans-shop-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(124,179,66,0.22), transparent 55%), radial-gradient(ellipse 70% 50% at 95% 100%, rgba(61,40,23,0.12), transparent 50%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-7xl gap-0 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="relative min-h-[220px] overflow-hidden bg-white sm:min-h-[280px] lg:col-span-5 lg:min-h-[320px]"
          >
            {productImage}
            <div className="absolute left-4 top-4 z-10 rounded-full bg-[var(--coffee-brown)]/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
              In store only
            </div>
          </motion.div>

          <div className="flex flex-col justify-center px-4 py-8 sm:px-8 lg:col-span-7 lg:px-10 lg:py-10">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.08 }}
            >
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--lime-green-dark)]">
                Fresh roasted whole beans
              </p>
              <h2
                id="retail-beans-shop-heading"
                className="text-3xl font-bold leading-tight text-[var(--coffee-brown)] sm:text-4xl"
              >
                {bean.name}
              </h2>
              <p className="mt-1 text-sm font-medium text-[var(--coffee-brown)]/70 sm:text-base">
                {bean.tagline}
              </p>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--coffee-brown)]/85 sm:text-lg">
                {bean.shortDescription} Available now at our Rockville cafe —{" "}
                <span className="font-semibold text-[var(--coffee-brown)]">
                  {bean.bagSize} whole-bean bags for {formatRetailPrice(bean.price)}
                </span>
                . Not sold online.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {bean.flavorNotes.map((note) => (
                  <span
                    key={note}
                    className="rounded-full border border-[var(--coffee-brown)]/15 bg-white/80 px-3 py-1 text-xs font-medium text-[var(--coffee-brown)]"
                  >
                    {note}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--coffee-brown)]/55">
                    Whole bean · {bean.bagSize}
                  </p>
                  <p className="text-3xl font-bold tabular-nums text-[var(--coffee-brown)]">
                    {formatRetailPrice(bean.price)}
                  </p>
                </div>
                <Link
                  href="/location"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--lime-green)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--lime-green-dark)] hover:shadow-lg"
                >
                  Visit us in store
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    );
  }

  // Home — editorial split composition
  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[var(--coffee-brown-dark)] py-16 px-4 sm:px-6 lg:py-24 lg:px-8"
      aria-labelledby="retail-beans-home-heading"
    >
      <motion.div
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-[var(--lime-green)] blur-3xl"
        style={{ opacity: glowOpacity }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cpath fill='%23ffffff' d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Media column */}
          <motion.div
            style={{ y: mediaY }}
            className="relative lg:col-span-5"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-white shadow-2xl ring-1 ring-white/10 sm:aspect-[3/4]"
            >
              {productImage}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--coffee-brown-dark)]/90 via-[var(--coffee-brown-dark)]/40 to-transparent p-5 pt-16">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lime-green-light)]">
                  Fresh whole beans · {bean.bagSize}
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {formatRetailPrice(bean.price)}
                </p>
              </div>
            </motion.div>

            {/* Floating meta chip */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="absolute -right-2 top-6 z-10 hidden rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md sm:block lg:-right-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                Pickup
              </p>
              <p className="text-sm font-semibold text-white">In store only</p>
            </motion.div>
          </motion.div>

          {/* Copy column */}
          <div className="lg:col-span-7">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[var(--lime-green)]"
            >
              Take home · Fresh roasted whole beans
            </motion.p>
            <motion.h2
              id="retail-beans-home-heading"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="text-3xl font-bold leading-[1.15] text-white sm:text-4xl md:text-5xl"
            >
              {bean.name}
              <span className="mt-2 block text-xl font-medium text-white/70 sm:text-2xl">
                Whole beans for your kitchen
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg"
            >
              {bean.description}
            </motion.p>

            {/* Spec grid */}
            <motion.dl
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {bean.highlights.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 backdrop-blur-sm"
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-white sm:text-base">
                    {item.value}
                  </dd>
                </motion.div>
              ))}
            </motion.dl>

            {/* Flavor notes */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.28, duration: 0.5 }}
              className="mt-6"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">
                Flavor notes
              </p>
              <div className="flex flex-wrap gap-2">
                {bean.flavorNotes.map((note, i) => (
                  <motion.span
                    key={note}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.05, duration: 0.35 }}
                    className="rounded-full border border-[var(--lime-green)]/35 bg-[var(--lime-green)]/10 px-3 py-1 text-xs font-medium text-[var(--lime-green-light)]"
                  >
                    {note}
                  </motion.span>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.35, duration: 0.45 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link
                href="/location"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--lime-green)] px-7 py-3.5 text-sm font-bold text-[var(--coffee-brown-dark)] transition hover:bg-[var(--lime-green-light)] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)] focus:ring-offset-2 focus:ring-offset-[var(--coffee-brown-dark)]"
              >
                Get directions
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="/shop"
                className="inline-flex items-center justify-center rounded-full border-2 border-white/35 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                View in shop
              </Link>
            </motion.div>

            <p className="mt-5 text-sm text-white/50">
              Fresh roasted whole beans. Sold exclusively in store at 1532 Rockville Pike.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
