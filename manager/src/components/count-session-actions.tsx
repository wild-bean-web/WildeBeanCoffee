"use client";

import { ClipboardCheck, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CountSessionActionsProps {
  canAdjust: boolean;
  openCount: {
    id: string;
    status: string;
    countedLines: number;
    totalLines: number;
  } | null;
  productCount: number;
}

export function CountSessionActions({
  canAdjust,
  openCount,
  productCount,
}: CountSessionActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"start" | "submit" | "approve" | null>(
    null,
  );

  async function run(
    action: "start" | "submit" | "approve",
    request: () => Promise<Response>,
  ) {
    setBusy(action);
    setMessage(null);
    try {
      const response = await request();
      const result = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(result.error?.message ?? "The count was not updated.");
      }
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The count was not updated.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAdjust && !openCount ? (
        <button
          type="button"
          className="button button-accent"
          disabled={busy !== null || productCount === 0}
          onClick={() =>
            run("start", () =>
              fetch("/api/counts/sessions", { method: "POST" }),
            )
          }
        >
          {busy === "start" ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : (
            <Plus size={17} />
          )}
          Start count
        </button>
      ) : null}
      {openCount &&
      openCount.status !== "submitted" &&
      openCount.countedLines === openCount.totalLines &&
      openCount.totalLines > 0 ? (
        <button
          type="button"
          className="button"
          disabled={busy !== null}
          onClick={() =>
            run("submit", () =>
              fetch(`/api/counts/sessions/${openCount.id}/submit`, {
                method: "POST",
              }),
            )
          }
        >
          {busy === "submit" ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : (
            <ClipboardCheck size={17} />
          )}
          Submit count
        </button>
      ) : null}
      {canAdjust && openCount?.status === "submitted" ? (
        <button
          type="button"
          className="button button-accent"
          disabled={busy !== null}
          onClick={() =>
            run("approve", () =>
              fetch(`/api/counts/sessions/${openCount.id}/approve`, {
                method: "POST",
              }),
            )
          }
        >
          {busy === "approve" ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : (
            <ClipboardCheck size={17} />
          )}
          Post as baseline
        </button>
      ) : null}
      {message ? <p className="w-full text-xs text-muted">{message}</p> : null}
    </div>
  );
}
