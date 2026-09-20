import type { ReactNode } from "react";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

interface StatusPillProps {
  children: ReactNode;
  tone?: StatusTone;
}

export function StatusPill({
  children,
  tone = "neutral",
}: StatusPillProps) {
  return <span className={`status-pill status-pill-${tone}`}>{children}</span>;
}
