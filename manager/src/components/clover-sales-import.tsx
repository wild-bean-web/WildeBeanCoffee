"use client";

import { LoaderCircle, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CloverSalesImport({
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

  async function importSales() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/sales/clover/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const result = (await response.json()) as {
        data?: {
          importedDays: number;
          failedDays: number;
          startsOn: string;
          endsOn: string;
        };
        error?: { message: string };
      };
      if (!response.ok || !result.data) {
        throw new Error(
          result.error?.message ?? "Clover sales were not imported.",
        );
      }
      setMessage(
        result.data.failedDays > 0
          ? `Imported ${result.data.importedDays} day${result.data.importedDays === 1 ? "" : "s"}; ${result.data.failedDays} day${result.data.failedDays === 1 ? "" : "s"} failed.`
          : `Imported ${result.data.importedDays} Clover day${result.data.importedDays === 1 ? "" : "s"} from ${result.data.startsOn} to ${result.data.endsOn}.`,
      );
      router.refresh();
    } catch (caught) {
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
        disabled={pending || !from || !to}
        title={!from || !to ? "Choose a start and end date to import" : undefined}
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
