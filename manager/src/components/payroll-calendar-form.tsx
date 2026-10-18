"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PayrollCalendarForm({
  anchor,
  periodDays,
  saved,
}: {
  anchor: string;
  periodDays: 7 | 14;
  saved: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(
    saved ? null : "This company is still using the default two-week calendar.",
  );
  const [error, setError] = useState<string | null>(null);

  async function save(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/payroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          anchor: String(formData.get("anchor") ?? ""),
          periodDays: Number(formData.get("periodDays")),
        }),
      });
      const result = (await response.json()) as { error?: { message: string } };
      if (!response.ok) {
        throw new Error(result.error?.message ?? "The pay calendar was not saved.");
      }
      setMessage("Pay calendar saved for this company.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The pay calendar was not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="payroll-calendar-form" action={save}>
      <label className="field">
        <span className="field-label">First day of a pay period</span>
        <input className="input" type="date" name="anchor" defaultValue={anchor} required />
      </label>
      <label className="field">
        <span className="field-label">Length</span>
        <select className="input" name="periodDays" defaultValue={String(periodDays)}>
          <option value="14">14 days</option>
          <option value="7">7 days</option>
        </select>
      </label>
      <button className="button button-accent" type="submit" disabled={pending}>
        {pending ? "Saving" : "Save pay calendar"}
      </button>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
