"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange } from "lucide-react";
import {
  reportRangePresets,
  sameRange,
  type DateRange,
} from "@/lib/date-range";

function rangeHref(
  pathname: string,
  range: DateRange | null,
  preserve?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  if (range) {
    params.set("from", range.startsOn);
    params.set("to", range.endsOn);
  }
  for (const [key, value] of Object.entries(preserve ?? {})) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function DateRangeFilter({
  from,
  to,
  allowAll = false,
  preserve,
}: {
  from: string;
  to: string;
  allowAll?: boolean;
  preserve?: Record<string, string | undefined>;
}) {
  const pathname = usePathname();
  const selected: DateRange = { startsOn: from, endsOn: to };
  const presets = reportRangePresets();
  const preserved = Object.entries(preserve ?? {}).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );

  return (
    <form className="date-range-filter" method="get">
      {preserved.map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <div className="date-range-filter-label">
        <CalendarRange size={16} aria-hidden="true" />
        <span>Date range</span>
      </div>
      <div className="date-range-presets" role="group" aria-label="Report presets">
        {presets.map((preset) => {
          const href = rangeHref(pathname, preset.range, preserve);
          const active = sameRange(selected, preset.range);
          return (
            <Link
              key={preset.id}
              href={href}
              className={`date-range-preset${active ? " date-range-preset-active" : ""}`}
            >
              {preset.label}
            </Link>
          );
        })}
        {allowAll ? (
          <Link
            href={rangeHref(pathname, null, preserve)}
            className={`date-range-preset${!from && !to ? " date-range-preset-active" : ""}`}
          >
            All dates
          </Link>
        ) : null}
      </div>
      <label className="date-range-field">
        <span>From</span>
        <input
          className="input"
          type="date"
          name="from"
          defaultValue={from}
          required={!allowAll}
        />
      </label>
      <label className="date-range-field">
        <span>To</span>
        <input
          className="input"
          type="date"
          name="to"
          defaultValue={to}
          required={!allowAll}
        />
      </label>
      <button type="submit" className="button">
        Apply
      </button>
    </form>
  );
}
