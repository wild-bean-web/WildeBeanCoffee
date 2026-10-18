"use client";

import { LoaderCircle, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CloverSalesImport({
  configured,
}: {
  configured: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importSales() {
    setPending(true);
    setError(null);
    setMessage("Finding the days that still need sales…");
    try {
      const planResponse = await fetch("/api/sales/clover/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: true }),
      });
      const plan = (await planResponse.json()) as {
        data?: { startsOn: string; endsOn: string; dates: string[] };
        error?: { message: string };
      };
      if (!planResponse.ok || !plan.data) {
        throw new Error(plan.error?.message ?? "Clover sales were not imported.");
      }

      const failures: string[] = [];
      let importedDays = 0;
      for (const [index, businessDate] of plan.data.dates.entries()) {
        setMessage(
          `Importing ${businessDate} (${index + 1} of ${plan.data.dates.length})…`,
        );
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 150_000);
        try {
          const response = await fetch("/api/sales/clover/import", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ businessDate }),
            signal: controller.signal,
          });
          const result = (await response.json()) as {
            data?: {
              importedDays: number;
              days: Array<{ businessDate: string; error: string | null }>;
            };
            error?: { message: string };
          };
          if (!response.ok || !result.data) {
            throw new Error(
              result.error?.message ?? "Clover sales were not imported.",
            );
          }
          importedDays += result.data.importedDays;
          for (const day of result.data.days) {
            if (day.error) failures.push(`${day.businessDate}: ${day.error}`);
          }
        } catch (caught) {
          const message =
            caught instanceof Error && caught.name === "AbortError"
              ? `${businessDate}: that day took too long. Try it again.`
              : caught instanceof Error
                ? caught.message
                : `${businessDate}: Clover sales were not imported.`;
          if (message.includes("cannot be unlocked") || message.includes("rejected this store")) {
            throw new Error(message);
          }
          failures.push(message);
        } finally {
          window.clearTimeout(timer);
        }
      }

      setMessage(
        `Imported ${importedDays} day${importedDays === 1 ? "" : "s"} from ${plan.data.startsOn} through ${plan.data.endsOn}.`,
      );
      setError(failures.length > 0 ? failures.slice(0, 3).join(" ") : null);
      router.refresh();
    } catch (caught) {
      setMessage(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Clover sales were not imported.",
      );
    } finally {
      setPending(false);
    }
  }

  if (!configured) {
    return (
      <p className="text-sm text-muted">
        Connect Clover in Store setup before importing sales for this location.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="button button-accent"
        onClick={() => void importSales()}
        disabled={pending}
        title="Imports the last saved day through today"
      >
        {pending ? (
          <LoaderCircle size={17} className="animate-spin" />
        ) : (
          <RefreshCcw size={17} />
        )}
        {pending ? "Importing Clover sales" : "Import Clover sales"}
      </button>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
