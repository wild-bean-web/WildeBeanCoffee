"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Maximize2, X } from "lucide-react";
import { DocumentOriginalPreview } from "@/components/document-original-preview";
import { StatusPill } from "@/components/status-pill";
import { formatMoney, formatShortDate } from "@/lib/format";

function formatHours(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface NamedAmount {
  code: string;
  label: string;
  amountCents: number;
  hours?: string | null;
  rate?: string | null;
}

interface PayrollEmployeeView {
  id: string;
  displayName: string;
  regularHours: string;
  overtimeHours: string;
  totalHours: string;
  regularRate: string | null;
  overtimeRate: string | null;
  regularWagesCents: number;
  overtimeWagesCents: number;
  tipsCents: number;
  wagesCents: number;
  grossCents: number;
  employeeTaxCents: number;
  netPayCents: number;
  employerTaxCents: number;
  loadedLaborCents: number;
  earnings: unknown;
  employeeTaxes: unknown;
  employerLiabilities: unknown;
}

interface PayrollRunView {
  id: string;
  status: string;
  companyName: string | null;
  checkDate: string | null;
  periodStartsOn: string | null;
  periodEndsOn: string | null;
  employeeCount: number;
  regularHours: string;
  overtimeHours: string;
  totalHours: string;
  regularWagesCents: number;
  overtimeWagesCents: number;
  tipsCents: number;
  wagesCents: number;
  grossCents: number;
  employeeTaxCents: number;
  netPayCents: number;
  employerTaxCents: number;
  loadedLaborCents: number;
}

function itemsFromJson(value: unknown): NamedAmount[] {
  if (!value || typeof value !== "object") return [];
  const items = "items" in value ? (value as { items: unknown }).items : value;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.label !== "string" || typeof row.amountCents !== "number") {
      return [];
    }
    return [
      {
        code: typeof row.code === "string" ? row.code : row.label,
        label: row.label,
        amountCents: row.amountCents,
        hours: typeof row.hours === "string" ? row.hours : null,
        rate: typeof row.rate === "string" ? row.rate : null,
      },
    ];
  });
}

function statusTone(status: string) {
  if (status === "posted") return "success" as const;
  if (status === "voided") return "danger" as const;
  return "warning" as const;
}

export function PayrollPreviewReview({
  documentId,
  filename,
  mimeType,
  originalUrl,
  run,
  employees,
  canPost,
}: {
  documentId: string;
  filename: string;
  mimeType: string;
  originalUrl: string;
  run: PayrollRunView;
  employees: PayrollEmployeeView[];
  canPost: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [focusEmployeeId, setFocusEmployeeId] = useState<string | null>(null);
  const closeDetails = useCallback(() => setDetailOpen(false), []);

  const periodLabel = useMemo(() => {
    if (!run.periodStartsOn || !run.periodEndsOn) return "Pay period pending";
    return `${formatShortDate(run.periodStartsOn)} – ${formatShortDate(run.periodEndsOn)}`;
  }, [run.periodEndsOn, run.periodStartsOn]);

  function openEmployeeDetails(employeeId?: string) {
    setFocusEmployeeId(employeeId ?? employees[0]?.id ?? null);
    setDetailOpen(true);
  }

  async function postLabor() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/payroll/documents/${documentId}/post`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(result.error?.message ?? "Labor cost was not posted.");
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Labor cost was not posted.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="content-grid content-grid-main">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{run.companyName ?? "Payroll preview"}</h2>
            <p>
              {periodLabel}
              {run.checkDate ? ` · Check date ${formatShortDate(run.checkDate)}` : ""}
            </p>
          </div>
          <StatusPill tone={statusTone(run.status)}>
            {run.status === "draft" ? "needs review" : run.status}
          </StatusPill>
        </div>
        <div className="panel-body">
          <section className="metrics-grid">
            <article className="metric-card">
              <div className="metric-label">
                <span>Loaded labor</span>
              </div>
              <p className="metric-value">{formatMoney(run.loadedLaborCents)}</p>
              <p className="metric-note">Wages + employer tax (not tips)</p>
            </article>
            <article className="metric-card">
              <div className="metric-label">
                <span>Wages</span>
              </div>
              <p className="metric-value">{formatMoney(run.wagesCents)}</p>
              <p className="metric-note">
                Regular {formatMoney(run.regularWagesCents)} · OT{" "}
                {formatMoney(run.overtimeWagesCents)}
              </p>
            </article>
            <article className="metric-card">
              <div className="metric-label">
                <span>Employer tax</span>
              </div>
              <p className="metric-value">{formatMoney(run.employerTaxCents)}</p>
              <p className="metric-note">Payroll tax liability</p>
            </article>
            <article className="metric-card">
              <div className="metric-label">
                <span>Hours</span>
              </div>
              <p className="metric-value">{formatHours(run.totalHours)}</p>
              <p className="metric-note">
                {formatHours(run.regularHours)} regular ·{" "}
                {formatHours(run.overtimeHours)} OT
              </p>
            </article>
          </section>

          <p className="mt-4 text-sm text-muted">
            Gross {formatMoney(run.grossCents)} includes {formatMoney(run.tipsCents)}{" "}
            in tips. Tips are paid through to employees and are not a store
            expense. Net pay {formatMoney(run.netPayCents)} is after employee
            tax of {formatMoney(run.employeeTaxCents)}.
          </p>

          {run.companyName?.startsWith("Clover time clock") ? (
            <p className="mt-3 text-sm text-muted">
              Clover does not send pay rates or payroll taxes. Hours come from
              the time clock. Wages use the last posted Paychex rates by name.
              Employer tax is estimated from that Paychex run. People without a
              matching rate show hours only. Upload Paychex when you need the
              filed payroll.
            </p>
          ) : null}

          {run.status === "posted" ? (
            <p className="mt-4 text-sm text-muted">
              This run is on the location P&L. Void it to take labor cost off
              the books, then upload a replacement for the same pay period.
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {run.status !== "voided" && canPost ? (
            <div className="mt-4 flex flex-wrap items-start gap-2">
              {run.status !== "posted" ? (
                <button
                  type="button"
                  className="button button-accent"
                  onClick={() => void postLabor()}
                  disabled={pending}
                >
                  {pending ? "Posting labor cost" : "Post labor cost"}
                </button>
              ) : null}
              <PayrollVoidButton
                documentId={documentId}
                posted={run.status === "posted"}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <button
            type="button"
            className="panel-title-action"
            aria-haspopup="dialog"
            aria-expanded={detailOpen}
            onClick={() => openEmployeeDetails()}
          >
            <h2>
              Employees
              <Maximize2 size={15} aria-hidden="true" />
            </h2>
            <p>
              {run.employeeCount} people on this preview. Open for a larger view
              of earnings, taxes, and employer liabilities.
            </p>
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="numeric">Reg hrs</th>
                <th className="numeric">OT hrs</th>
                <th className="numeric">Wages</th>
                <th className="numeric">Tips</th>
                <th className="numeric">ER tax</th>
                <th className="numeric">Labor cost</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr
                  key={employee.id}
                  className="table-group-link"
                  onClick={() => openEmployeeDetails(employee.id)}
                >
                  <td>
                    <p className="font-semibold">{employee.displayName}</p>
                    <p className="text-xs text-muted">
                      {employee.regularRate
                        ? `${formatMoney(Math.round(Number.parseFloat(employee.regularRate) * 100))}/hr`
                        : "Rate on file"}
                      {employee.overtimeRate
                        ? ` · OT ${formatMoney(Math.round(Number.parseFloat(employee.overtimeRate) * 100))}`
                        : ""}
                    </p>
                  </td>
                  <td className="numeric">{formatHours(employee.regularHours)}</td>
                  <td className="numeric">{formatHours(employee.overtimeHours)}</td>
                  <td className="numeric">{formatMoney(employee.wagesCents)}</td>
                  <td className="numeric">{formatMoney(employee.tipsCents)}</td>
                  <td className="numeric">{formatMoney(employee.employerTaxCents)}</td>
                  <td className="numeric">{formatMoney(employee.loadedLaborCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Pay period</th>
                <th className="numeric">{formatHours(run.regularHours)}</th>
                <th className="numeric">{formatHours(run.overtimeHours)}</th>
                <th className="numeric">{formatMoney(run.wagesCents)}</th>
                <th className="numeric">{formatMoney(run.tipsCents)}</th>
                <th className="numeric">{formatMoney(run.employerTaxCents)}</th>
                <th className="numeric">{formatMoney(run.loadedLaborCents)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {mimeType === "application/pdf" || mimeType.startsWith("image/") ? (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Original preview</h2>
            <p>{filename}</p>
          </div>
        </div>
        <DocumentOriginalPreview
          src={originalUrl}
          title={filename}
          mimeType={mimeType}
        />
      </section>
      ) : null}

      {detailOpen ? (
        <PayrollEmployeesModal
          periodLabel={periodLabel}
          checkDate={run.checkDate}
          employees={employees}
          focusEmployeeId={focusEmployeeId}
          onClose={closeDetails}
        />
      ) : null}
    </div>
  );
}

export function PayrollVoidButton({
  documentId,
  posted = false,
}: {
  documentId: string;
  posted?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function voidLabor() {
    const confirmed = window.confirm(
      posted
        ? "Void this posted payroll? Loaded labor comes off the P&L for this location. You can upload this pay period again after it is voided."
        : "Remove this payroll preview? You can upload the same file again if this was a mistake.",
    );
    if (!confirmed) return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/payroll/documents/${documentId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(result.error?.message ?? "Payroll was not voided.");
      }
      router.push("/labor");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Payroll was not voided.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="button button-danger"
        onClick={() => void voidLabor()}
        disabled={pending}
      >
        {pending
          ? posted
            ? "Voiding posted labor"
            : "Removing preview"
          : posted
            ? "Void posted labor"
            : "Remove this preview"}
      </button>
    </div>
  );
}

function PayrollEmployeesModal({
  periodLabel,
  checkDate,
  employees,
  focusEmployeeId,
  onClose,
}: {
  periodLabel: string;
  checkDate: string | null;
  employees: PayrollEmployeeView[];
  focusEmployeeId: string | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!focusEmployeeId) return;
    document
      .getElementById(`payroll-employee-${focusEmployeeId}`)
      ?.scrollIntoView({ block: "start" });
  }, [focusEmployeeId]);

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-employees-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="payroll-employees-title">Employees</h2>
            <p>
              {periodLabel}
              {checkDate ? ` · Check date ${formatShortDate(checkDate)}` : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            aria-label="Close employee details"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          {employees.map((employee) => (
            <EmployeeDetailCard
              key={employee.id}
              employee={employee}
              highlighted={employee.id === focusEmployeeId}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function EmployeeDetailCard({
  employee,
  highlighted,
}: {
  employee: PayrollEmployeeView;
  highlighted: boolean;
}) {
  const earnings = itemsFromJson(employee.earnings);
  const taxes = itemsFromJson(employee.employeeTaxes);
  const liabilities = itemsFromJson(employee.employerLiabilities);

  return (
    <article
      id={`payroll-employee-${employee.id}`}
      className="payroll-employee-card"
      data-highlighted={highlighted ? "true" : undefined}
    >
      <div className="payroll-employee-heading">
        <div>
          <h3>{employee.displayName}</h3>
          <p>
            {employee.regularRate
              ? `${formatMoney(Math.round(Number.parseFloat(employee.regularRate) * 100))}/hr`
              : "Rate on file"}
            {employee.overtimeRate
              ? ` · OT ${formatMoney(Math.round(Number.parseFloat(employee.overtimeRate) * 100))}`
              : ""}
            {` · ${formatHours(employee.totalHours)} hrs`}
          </p>
        </div>
        <p className="payroll-employee-labor">
          {formatMoney(employee.loadedLaborCents)}
        </p>
      </div>
      <dl className="payroll-employee-stats">
        <div>
          <dt>Regular / OT hours</dt>
          <dd>
            {formatHours(employee.regularHours)} / {formatHours(employee.overtimeHours)}
          </dd>
        </div>
        <div>
          <dt>Wages</dt>
          <dd>{formatMoney(employee.wagesCents)}</dd>
        </div>
        <div>
          <dt>Tips</dt>
          <dd>{formatMoney(employee.tipsCents)}</dd>
        </div>
        <div>
          <dt>Gross / net</dt>
          <dd>
            {formatMoney(employee.grossCents)} / {formatMoney(employee.netPayCents)}
          </dd>
        </div>
        <div>
          <dt>Employee tax</dt>
          <dd>{formatMoney(employee.employeeTaxCents)}</dd>
        </div>
        <div>
          <dt>Employer tax</dt>
          <dd>{formatMoney(employee.employerTaxCents)}</dd>
        </div>
      </dl>
      <div className="payroll-detail-grid">
        <DetailList title="Earnings" rows={earnings} showHours />
        <DetailList title="Employee taxes" rows={taxes} />
        <DetailList title="Employer liabilities" rows={liabilities} />
      </div>
    </article>
  );
}

function DetailList({
  title,
  rows,
  showHours = false,
}: {
  title: string;
  rows: NamedAmount[];
  showHours?: boolean;
}) {
  return (
    <div className="payroll-detail-list">
      <p>{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">None extracted</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={`${row.code}-${row.label}`}>
              <span>
                {row.label}
                {showHours && row.hours ? ` · ${formatHours(row.hours)} hrs` : ""}
                {showHours && row.rate
                  ? ` · ${formatMoney(Math.round(Number.parseFloat(row.rate) * 100))}/hr`
                  : ""}
              </span>
              <span className="numeric">{formatMoney(row.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
