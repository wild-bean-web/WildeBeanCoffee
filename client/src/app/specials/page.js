"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { specialsApi } from "@/lib/api";

const CATEGORIES = ["All", "Coffee", "Matcha", "Refreshers"];

const CATEGORY_ACCENT = {
  Coffee: "border-l-[var(--coffee-brown)]",
  Matcha: "border-l-[var(--lime-green)]",
  Refreshers: "border-l-sky-500",
};

function formatWeek(special) {
  if (special.weekLabel) return `Week of ${special.weekLabel}`;
  if (!special.weekOf) return "";
  const d = new Date(special.weekOf);
  return `Week of ${d.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
  })}`;
}

export default function StaffSpecialsPage() {
  const [specials, setSpecials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const filters = {};
        if (category !== "All") filters.category = category;
        if (debouncedSearch) filters.search = debouncedSearch;
        const result = await specialsApi.getAll(filters);
        if (!cancelled) {
          setSpecials(result.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load specials");
          setSpecials([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [category, debouncedSearch]);

  const grouped = useMemo(() => {
    const order = ["Coffee", "Matcha", "Refreshers"];
    const map = { Coffee: [], Matcha: [], Refreshers: [] };
    for (const item of specials) {
      if (map[item.category]) map[item.category].push(item);
      else {
        if (!map.Other) map.Other = [];
        map.Other.push(item);
      }
    }
    return order
      .filter((key) => map[key]?.length)
      .map((key) => ({ category: key, items: map[key] }));
  }, [specials]);

  return (
    <div className="min-h-screen bg-[var(--coffee-brown-very-light)]">
      <header className="sticky top-0 z-20 border-b border-[var(--coffee-brown)]/10 bg-[var(--coffee-brown-dark)] text-white shadow-md">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Staff · Recipe lookup
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
            Weekly Specials
          </h1>
          <p className="mt-1 text-sm text-white/75">
            Search any past or current special — Coffee, Matcha, or Refreshers.
          </p>

          <div className="mt-4">
            <label htmlFor="specials-search" className="sr-only">
              Search specials
            </label>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--coffee-brown-medium-light)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                />
              </svg>
              <input
                id="specials-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or ingredient…"
                autoComplete="off"
                className="w-full rounded-lg border-0 bg-white py-3 pl-11 pr-4 text-base text-[var(--coffee-brown)] placeholder:text-[var(--coffee-brown-medium-light)] shadow-sm outline-none ring-2 ring-transparent focus:ring-[var(--lime-green)]"
              />
            </div>
          </div>

          <div
            className="mt-3 flex gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Filter by category"
          >
            {CATEGORIES.map((cat) => {
              const selected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setCategory(cat)}
                  className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? "bg-[var(--lime-green)] text-white"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--coffee-brown)]">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--coffee-brown-light)] border-t-[var(--lime-green)]" />
            <p className="mt-4 text-sm">Loading specials…</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {!loading && !error && specials.length === 0 && (
          <div className="rounded-lg border border-[var(--coffee-brown)]/15 bg-white px-4 py-10 text-center text-[var(--coffee-brown)]">
            <p className="font-semibold">No specials found</p>
            <p className="mt-1 text-sm text-[var(--coffee-brown-light)]">
              Try a different search or category.
            </p>
          </div>
        )}

        {!loading && !error && grouped.length > 0 && (
          <div className="space-y-8">
            {grouped.map((group) => (
              <section key={group.category} aria-labelledby={`cat-${group.category}`}>
                <h2
                  id={`cat-${group.category}`}
                  className="mb-3 text-lg font-bold text-[var(--coffee-brown-dark)]"
                >
                  {group.category}
                  <span className="ml-2 text-sm font-medium text-[var(--coffee-brown-light)]">
                    ({group.items.length})
                  </span>
                </h2>
                <ul className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {group.items.map((special) => (
                      <motion.li
                        key={special._id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`rounded-lg border border-[var(--coffee-brown)]/10 border-l-4 bg-white p-4 shadow-sm ${
                          CATEGORY_ACCENT[special.category] ||
                          "border-l-[var(--coffee-brown-medium-light)]"
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="text-lg font-semibold text-[var(--coffee-brown-dark)]">
                            {special.name}
                          </h3>
                          <span className="text-xs font-medium uppercase tracking-wide text-[var(--coffee-brown-light)]">
                            {formatWeek(special)}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--lime-green-dark)]">
                              16 oz
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-[var(--coffee-brown)]">
                              {special.recipe16oz}
                            </p>
                          </div>
                          {special.recipe20oz ? (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-[var(--lime-green-dark)]">
                                20 oz
                              </p>
                              <p className="mt-1 text-sm leading-relaxed text-[var(--coffee-brown)]">
                                {special.recipe20oz}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        {special.notes ? (
                          <p className="mt-3 text-xs italic text-[var(--coffee-brown-light)]">
                            {special.notes}
                          </p>
                        ) : null}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
