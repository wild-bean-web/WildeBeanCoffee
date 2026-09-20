export const PRIME_COST_BENCHMARKS = {
  cogsShare: 0.32,
  laborShare: 0.3,
  primeCostShare: 0.62,
} as const;

export interface ProfitCostLine {
  key: string;
  label: string;
  cents: number;
  complete: boolean;
}

export function salesRatio(partCents: number, netSalesCents: number): number | null {
  if (netSalesCents <= 0) return null;
  return partCents / netSalesCents;
}

export function primeCostCents(cogsCents: number, loadedLaborCents: number): number {
  return cogsCents + loadedLaborCents;
}

export function contributionAfterPrimeCents(
  netSalesCents: number,
  primeCents: number,
): number {
  return netSalesCents - primeCents;
}

export function largestCostLine(
  lines: readonly ProfitCostLine[],
): ProfitCostLine | null {
  const complete = lines.filter((line) => line.complete && line.cents > 0);
  if (complete.length === 0) return null;
  return complete.reduce((highest, line) =>
    line.cents > highest.cents ? line : highest,
  );
}
