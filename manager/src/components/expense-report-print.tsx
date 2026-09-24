"use client";

export function ExpenseReportPrint() {
  return (
    <button
      type="button"
      className="button button-primary expense-report-print"
      onClick={() => window.print()}
    >
      Save as PDF
    </button>
  );
}
