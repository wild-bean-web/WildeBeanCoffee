import { formatMoney } from "@/lib/format";

export interface MoneySlice {
  label: string;
  cents: number;
  color: string;
}

function polar(cx: number, cy: number, radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

function slicePath(start: number, end: number): string {
  const outer = 78;
  const inner = 48;
  const sweep = end - start;
  if (sweep >= 359.9) {
    return `M 110 32 A 78 78 0 1 1 109.9 32 L 110 62 A 48 48 0 1 0 110.1 62 Z`;
  }
  const large = sweep > 180 ? 1 : 0;
  const [x1, y1] = polar(110, 110, outer, start);
  const [x2, y2] = polar(110, 110, outer, end);
  const [x3, y3] = polar(110, 110, inner, end);
  const [x4, y4] = polar(110, 110, inner, start);
  return `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
}

export function MoneyDonut({
  slices,
  centerLabel,
  centerCents,
}: {
  slices: MoneySlice[];
  centerLabel: string;
  centerCents: number;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(slice.cents, 0), 0);
  let cursor = 0;
  const paths =
    total <= 0
      ? []
      : slices
          .filter((slice) => slice.cents > 0)
          .map((slice) => {
            const sweep = (slice.cents / total) * 360;
            const path = slicePath(cursor, cursor + sweep);
            cursor += sweep;
            return { ...slice, path };
          });

  return (
    <div className="money-picture">
      <svg viewBox="0 0 220 220" role="img" aria-label={centerLabel}>
        <circle cx="110" cy="110" r="78" className="money-donut-track" />
        {paths.map((slice) => (
          <path key={slice.label} d={slice.path} fill={slice.color}>
            <title>{`${slice.label} ${formatMoney(slice.cents)}`}</title>
          </path>
        ))}
        <text x="110" y="104" textAnchor="middle" className="money-donut-label">
          {centerLabel}
        </text>
        <text
          x="110"
          y="128"
          textAnchor="middle"
          className={centerCents < 0 ? "money-donut-value money-negative" : "money-donut-value money-positive"}
        >
          {formatMoney(centerCents)}
        </text>
      </svg>
      <ul className="money-legend">
        {slices.map((slice) => (
          <li key={slice.label}>
            <i style={{ background: slice.color }} />
            <span>{slice.label}</span>
            <strong className={slice.cents < 0 ? "money-negative" : undefined}>
              {formatMoney(slice.cents)}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
