"use client";

import { CheckCircle2, FileText, LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type CaptureState = "idle" | "uploading" | "accepted" | "error";

export function PayrollCapture() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<CaptureState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setState("uploading");
    setMessage(null);

    const body = new FormData();
    body.set("file", file);

    try {
      const response = await fetch("/api/payroll/documents", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as {
        data?: {
          documentId: string;
          employeeCount: number | null;
          loadedLaborCents: number | null;
        };
        error?: { message: string };
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error?.message ?? "The payroll preview was not accepted.",
        );
      }

      setDocumentId(result.data.documentId);
      setState("accepted");
      setMessage(
        result.data.employeeCount
          ? `Extracted ${result.data.employeeCount} employees. Review hours, wages, tips, and employer tax before posting labor cost.`
          : "Payroll file stored. Open it to review the extracted pay period.",
      );
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "The payroll preview could not be uploaded.",
      );
    }
  }

  function chooseAnother() {
    setFile(null);
    setState("idle");
    setMessage(null);
    setDocumentId(null);
  }

  if (state === "accepted" && documentId) {
    return (
      <section className="panel">
        <div className="empty-state">
          <div>
            <div className="empty-state-icon">
              <CheckCircle2 size={25} aria-hidden="true" />
            </div>
            <h2>Payroll preview extracted</h2>
            <p>{message}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="button button-accent"
                onClick={() => router.push(`/documents/${documentId}`)}
              >
                Review employees
              </button>
              <button type="button" className="button" onClick={chooseAnother}>
                Upload another period
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-header">
        <div>
          <h2>Upload a pay-period preview</h2>
          <p>
            Use the Paychex payroll preview PDF after each two-week period
            ends. The same file or pay period cannot be stored twice until the
            existing copy is voided. Tips stay a pass-through; labor cost is
            wages plus employer tax.
          </p>
        </div>
      </div>
      <div className="panel-body">
        <label className="capture-dropzone">
          <input
            type="file"
            name="payroll"
            accept="application/pdf"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setMessage(null);
              setState("idle");
            }}
            required
          />
          <div>
            <div className="capture-dropzone-icon">
              <Upload size={29} aria-hidden="true" />
            </div>
            <h2>Choose the payroll preview PDF</h2>
            <p>
              The original file is stored privately. Hours, rates, wages, tips,
              employee taxes, and employer liabilities are extracted without
              sending the PDF to Azure.
            </p>
          </div>
        </label>

        {file ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-stone-50 p-3">
            <FileText size={18} className="shrink-0 text-stone-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-muted">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              className="button button-quiet"
              onClick={chooseAnother}
            >
              Change
            </button>
          </div>
        ) : null}

        {message && state === "error" ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          className="button button-accent mt-4"
          disabled={!file || state === "uploading"}
        >
          {state === "uploading" ? (
            <>
              <LoaderCircle size={17} className="animate-spin" />
              Extracting payroll
            </>
          ) : (
            <>
              <Upload size={17} />
              Extract labor cost
            </>
          )}
        </button>
      </div>
    </form>
  );
}
