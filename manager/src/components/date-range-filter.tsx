"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange } from "lucide-react";
import {
  reportRangePresets,
  sameRange,
  type DateRange,
} from "@/lib/date-range";

export function DateRangeFilter({
  from,
  to,
  allowAll = false,
}: {
  from: string;
  to: string;
  allowAll?: boolean;
}) {
  const pathname = usePathname();
  const selected: DateRange = { startsOn: from, endsOn: to };
  const presets = reportRangePresets();

  return (
    <form className="date-range-filter" method="get">
      <div className="date-range-filter-label">
        <CalendarRange size={16} aria-hidden="true" />
        <span>Date range</span>
      </div>
      <div className="date-range-presets" role="group" aria-label="Report presets">
        {presets.map((preset) => {
          const href = `${pathname}?from=${preset.range.startsOn}&to=${preset.range.endsOn}`;
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
            href={pathname}
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
