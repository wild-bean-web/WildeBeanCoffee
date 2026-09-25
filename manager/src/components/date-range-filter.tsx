"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Calendar, CalendarRange } from "lucide-react";
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

function compactDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Choose";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${iso}T12:00:00.000Z`));
}

function CalendarField({
  label,
  name,
  initialValue,
  required,
}: {
  label: string;
  name: string;
  initialValue: string;
  required: boolean;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <label className="date-range-field">
      <span>{label}</span>
      <span className="date-picker-face" aria-hidden="true">
        <Calendar size={16} />
        <span>{compactDate(value)}</span>
      </span>
      <input
        className="input date-picker-input"
        type="date"
        name={name}
        value={value}
        required={required}
        aria-label={label}
        onChange={(event) => setValue(event.target.value)}
      />
    </label>
  );
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
  const matchesPreset = presets.some((preset) => sameRange(selected, preset.range));
  const customActive = Boolean(from && to) && !matchesPreset;

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
            All time
          </Link>
        ) : null}
      </div>
      <div className={`date-range-custom${customActive ? " date-range-custom-active" : ""}`}>
        <span className="date-range-custom-label">Custom</span>
      <CalendarField
        key={`from-${from}`}
        label="From"
        name="from"
        initialValue={from}
        required={!allowAll}
      />
      <CalendarField
        key={`to-${to}`}
        label="To"
        name="to"
        initialValue={to}
        required={!allowAll}
      />
      <button type="submit" className="button">
        Apply
      </button>
      </div>
    </form>
  );
}
