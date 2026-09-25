"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatShortDate } from "@/lib/format";

export interface StatementBasisView {
  lineCount: number;
  latestDate: string | null;
  upload: {
    filename: string;
    createdAt: string;
    status: string;
    addedCount: number;
    message: string;
    startsOn: string | null;
    endsOn: string | null;
  } | null;
}

export function StatementSource({ basis }: { basis: StatementBasisView }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/expenses/statements", {
        method: "POST",
        body: new FormData(form),
      });
      const body = (await response.json()) as {
        data?: { message?: string };
        error?: { message?: string };
      };
      setFailed(!response.ok);
      setNotice(
        body.data?.message ??
          body.error?.message ??
          "The statement could not be read.",
      );
      if (response.ok) {
        form.reset();
        router.refresh();
      }
    } catch {
      setFailed(true);
      setNotice("The statement could not be uploaded. Try again.");
    } finally {
      setPending(false);
    }
  }

  const booksText =
    basis.lineCount > 0
      ? `Books include ${basis.lineCount.toLocaleString()} transactions through ${
          basis.latestDate ? formatShortDate(basis.latestDate) : "the latest recorded date"
        }.`
      : "No bank transactions are on file yet.";
  const uploadText = basis.upload
    ? `Latest upload: ${basis.upload.filename}. ${basis.upload.message}`
    : "The opening books were loaded from statements already on file.";

  return (
    <section className="panel mb-5">
      <div className="panel-header">
        <div>
          <h2>Statement this page is based on</h2>
          <p>
            {booksText} {basis.lineCount > 0 ? uploadText : ""}
          </p>
        </div>
      </div>
      <form className="statement-upload" onSubmit={onSubmit}>
        <label className="field">
          <span>Upload a bank statement PDF</span>
          <input name="file" type="file" accept="application/pdf,.pdf" required />
        </label>
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending ? "Reading statement…" : "Add statement"}
        </button>
      </form>
      {notice ? (
        <p className={failed ? "form-error" : "metric-note"} role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
