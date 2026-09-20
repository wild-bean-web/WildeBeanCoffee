"use client";

import { LoaderCircle, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CloverLaborImport({
  from,
  to,
  configured,
}: {
  from: string;
  to: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importLabor() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/payroll/clover/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const result = (await response.json()) as {
        data?: {
          documentId: string;
          employeeCount: number;
          loadedLaborCents: number;
          unmatchedEmployeeCount: number;
          startsOn: string;
          endsOn: string;
        };
        error?: { message: string };
      };
      if (!response.ok || !result.data) {
        throw new Error(
          result.error?.message ?? "Clover time clock hours were not imported.",
        );
      }
      const unmatched =
        result.data.unmatchedEmployeeCount > 0
          ? ` ${result.data.unmatchedEmployeeCount} employee${result.data.unmatchedEmployeeCount === 1 ? "" : "s"} did not match a Paychex rate.`
          : "";
      setMessage(
        `Imported ${result.data.employeeCount} Clover employee${result.data.employeeCount === 1 ? "" : "s"} from ${result.data.startsOn} to ${result.data.endsOn}.${unmatched}`,
      );
      router.push(`/documents/${result.data.documentId}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Clover time clock hours were not imported.",
      );
    } finally {
      setPending(false);
    }
  }

  if (!configured) {
    return (
      <p className="text-sm text-muted">
        Connect Clover in Store setup, with Employees (read), before importing
        the time clock.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="button button-accent"
        onClick={() => void importLabor()}
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle size={17} className="animate-spin" />
        ) : (
          <RefreshCcw size={17} />
        )}
        {pending ? "Importing Clover hours" : "Import Clover time clock"}
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
