"use client";

import { LoaderCircle, PackageCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface StagedCatalogBatch {
  id: string;
  sourceFilename: string;
  status: string;
  rowCount: number;
  reviewCount: number;
}

export function CatalogImportPost({
  batch,
  canPost,
}: {
  batch: StagedCatalogBatch;
  canPost: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const posted = batch.status === "posted";

  async function postCatalog() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/imports/inventory/${batch.id}/post`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        data?: {
          productCount: number;
          vendorCount: number;
          alreadyPosted?: boolean;
        };
        error?: { message: string };
      };
      if (!response.ok || !result.data) {
        throw new Error(
          result.error?.message ?? "The count-sheet catalog was not posted.",
        );
      }
      setMessage(
        result.data.alreadyPosted
          ? `${result.data.productCount} count-sheet item${result.data.productCount === 1 ? "" : "s"} already posted.`
          : `Posted ${result.data.productCount} count-sheet item${result.data.productCount === 1 ? "" : "s"}${result.data.vendorCount > 0 ? ` from ${result.data.vendorCount} vendor${result.data.vendorCount === 1 ? "" : "s"}` : ""}.`,
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The count-sheet catalog was not posted.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {canPost && !posted ? (
        <button
          type="button"
          className="button button-accent"
          disabled={pending}
          onClick={() => void postCatalog()}
        >
          {pending ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <PackageCheck size={17} />
          )}
          Post to count sheet
        </button>
      ) : null}
      {message ? <p className="text-xs text-muted">{message}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
