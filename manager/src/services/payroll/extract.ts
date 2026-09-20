import "server-only";

import type { SourceDocument } from "@/db/schema";

export function isPayrollCapture(document: SourceDocument): boolean {
  const kind =
    typeof document.metadata.documentKind === "string"
      ? document.metadata.documentKind
      : "";
  if (kind === "payroll") return true;
  return /payroll/i.test(document.originalFileName);
}
