"use client";

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { LineChart, X } from "lucide-react";
import {
  graphSpanSeries,
  graphSpans,
  type DailyFlowPoint,
  type GraphSpan,
  type SalesExpensePoint,
  type SalesExpenseSeries,
} from "@/domain/sales-expense-series";
import { formatMoney, formatShortDate } from "@/lib/format";

const SALES_COLOR = "#1f8a4c";
const EXPENSE_COLOR = "#d64545";

function axisMoney(cents: number): string {
  const dollars = cents / 100;
  const absolute = Math.abs(dollars);
  if (absolute >= 1000) {
    const digits = absolute >= 10000 ? 0 : 1;
    return `${dollars < 0 ? "-" : ""}$${(absolute / 1000).toFixed(digits)}k`;
  }
  return formatMoney(cents);
}

function pointLabel(isoDate: string, grain: SalesExpenseSeries["grain"]): string {
  if (grain === "month") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      year: "numeric",
    }).format(new Date(`${isoDate}T12:00:00.000Z`));
  }
  if (grain === "week") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    }).format(new Date(`${isoDate}T12:00:00.000Z`));
  }
  return formatShortDate(isoDate);
}

function chartValues(points: SalesExpensePoint[]): number[] {
  return points.flatMap((point) =>
    [point.salesCents, point.expenseCents].filter((value): value is number => value !== null),
  );
}

function chartGeometry(points: SalesExpensePoint[]) {
  const width = 720;
  const height = 320;
  const left = 58;
  const right = 16;
  const top = 18;
  const bottom = 36;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = chartValues(points);
  const lowest = values.length > 0 ? Math.min(...values) : 0;
  const highest = values.length > 0 ? Math.max(...values) : 1;
  const pad = highest === lowest ? Math.max(Math.abs(highest) * 0.2, 1) : (highest - lowest) * 0.12;
  let min = lowest - pad;
  let max = highest + pad;
  if (lowest >= 0 && min < 0) min = 0;
  const span = max - min || 1;
  const xAt = (index: number) =>
    points.length <= 1 ? left + plotWidth / 2 : left + (index / (points.length - 1)) * plotWidth;
  const yAt = (value: number) => top + plotHeight - ((value - min) / span) * plotHeight;
  return { width, height, left, right, top, bottom, plotWidth, plotHeight, min, max, xAt, yAt };
}

function linePath(
  points: SalesExpensePoint[],
  key: "salesCents" | "expenseCents",
  geometry: ReturnType<typeof chartGeometry>,
): string {
  let drawing = false;
  const commands: string[] = [];
  points.forEach((point, index) => {
    const value = point[key];
    if (value === null) {
      drawing = false;
      return;
    }
    commands.push(
      `${drawing ? "L" : "M"} ${geometry.xAt(index).toFixed(2)} ${geometry.yAt(value).toFixed(2)}`,
    );
    drawing = true;
  });
  return commands.join(" ");
}

function HoverMarker({
  point,
  index,
  series,
  grain,
  geometry,
}: {
  point: SalesExpensePoint;
  index: number;
  series: "sales" | "expenses";
  grain: SalesExpenseSeries["grain"];
  geometry: ReturnType<typeof chartGeometry>;
}) {
  const x = geometry.xAt(index);
  const date = pointLabel(point.isoDate, grain);
  const focusedValue = series === "expenses" ? point.expenseCents : point.salesCents;
  const focusedColor = series === "expenses" ? EXPENSE_COLOR : SALES_COLOR;
  const chipWidth = Math.max(92, date.length * 6.4 + 18);
  const chipX = Math.min(
    Math.max(x - chipWidth / 2, 4),
    geometry.width - chipWidth - 4,
  );
  const value =
    focusedValue === null ? "Not recorded" : formatMoney(focusedValue);
  const valueWidth = Math.max(72, value.length * 6.6 + 16);
  const dotY =
    series === "expenses" && point.expenseCents !== null
      ? geometry.yAt(point.expenseCents)
      : geometry.yAt(point.salesCents);
  const valueX =
    x + 10 + valueWidth > geometry.width - geometry.right ? x - valueWidth - 10 : x + 10;

  return (
    <g>
      <line
        x1={x}
        x2={x}
        y1={geometry.top}
        y2={geometry.height - geometry.bottom}
        className="trend-guide"
      />
      <circle
        cx={x}
        cy={geometry.yAt(point.salesCents)}
        r={series === "sales" ? 5.5 : 3.5}
        fill={SALES_COLOR}
      />
      {point.expenseCents !== null ? (
        <circle
          cx={x}
          cy={geometry.yAt(point.expenseCents)}
          r={series === "expenses" ? 5.5 : 3.5}
          fill={EXPENSE_COLOR}
        />
      ) : null}
      <g>
        <rect
          x={chipX}
          y={2}
          width={chipWidth}
          height={18}
          rx={9}
          fill={focusedColor}
        />
        <text x={chipX + chipWidth / 2} y={14.5} textAnchor="middle" className="trend-hover-date">
          {date}
        </text>
      </g>
      <g>
        <rect
          x={valueX}
          y={dotY - 12}
          width={valueWidth}
          height={18}
          rx={9}
          fill={focusedColor}
        />
        <text x={valueX + valueWidth / 2} y={dotY + 1} textAnchor="middle" className="trend-hover-date">
          {value}
        </text>
      </g>
    </g>
  );
}

function GroupedBars({
  points,
  grain,
  secondLabel,
  activeIndex,
  onSelect,
}: {
  points: SalesExpensePoint[];
  grain: SalesExpenseSeries["grain"];
  secondLabel: string;
  activeIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(640);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setHostWidth(host.clientWidth || 640);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const width = 640;
  const height = 176;
  const left = 8;
  const right = 8;
  const top = 10;
  const bottom = 28;
  const plotBottom = height - bottom;
  const plotHeight = plotBottom - top;
  const slot = (width - left - right) / Math.max(points.length, 1);
  const barWidth = Math.max(3, Math.min(14, slot * 0.3));
  const pixelsPerUnit = Math.max(hostWidth, 1) / width;
  const axisFont = 11 / pixelsPerUnit;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(hostWidth / 96))));
  const peak = Math.max(
    1,
    ...points.flatMap((point) => [point.salesCents, Math.max(point.expenseCents ?? 0, 0)]),
  );
  const barTop = (value: number) => top + plotHeight - (Math.max(value, 0) / peak) * plotHeight;
  const labelStep = labelEvery;

  function select(event: PointerEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix || points.length === 0) return;
    const pointer = svg.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const local = pointer.matrixTransform(matrix.inverse());
    const index = Math.min(
      points.length - 1,
      Math.max(0, Math.floor((local.x - left) / slot)),
    );
    onSelect(index);
  }

  return (
    <div className="trend-scroll" ref={hostRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Bar chart of sales and ${secondLabel.toLowerCase()}`}
        onPointerDown={select}
      >
        <line x1={left} x2={width - right} y1={plotBottom} y2={plotBottom} className="trend-grid" />
        {points.map((point, index) => {
          const x = left + index * slot;
          const pair = barWidth * 2 + 2;
          const start = x + Math.max(0, (slot - pair) / 2);
          const salesHeight = Math.max(plotBottom - barTop(point.salesCents), point.salesCents > 0 ? 2 : 0);
          const labor = Math.max(point.expenseCents ?? 0, 0);
          const laborHeight = Math.max(plotBottom - barTop(labor), labor > 0 ? 2 : 0);
          const selected = index === activeIndex;
          const showLabel =
            index === 0 || index === points.length - 1 || (index % labelStep === 0 && points.length - index >= labelStep);
          return (
            <g key={point.isoDate} opacity={activeIndex === null || selected ? 1 : 0.72}>
              <rect x={start} y={plotBottom - salesHeight} width={barWidth} height={salesHeight} rx={2} fill={SALES_COLOR} />
              <rect x={start + barWidth + 2} y={plotBottom - laborHeight} width={barWidth} height={laborHeight} rx={2} fill={EXPENSE_COLOR} />
              {showLabel ? (
                <text
                  x={index === 0 ? left : index === points.length - 1 ? width - right : x + slot / 2}
                  y={height - 8}
                  textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
                  className="trend-bar-label"
                  fontSize={axisFont}
                >
                  {pointLabel(point.isoDate, grain)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function grainCaption(grain: SalesExpenseSeries["grain"]): string {
  if (grain === "day") return "Each point is one day";
  if (grain === "week") return "Each point is one week";
  return "Each point is one month";
}

export function SalesExpenseGraph({
  days,
  today,
  title = "Sales and expenses",
  secondLabel = "Expenses",
  presentation = "button",
  chart = "line",
}: {
  days: DailyFlowPoint[];
  today: string;
  title?: string;
  secondLabel?: string;
  presentation?: "button" | "inline";
  chart?: "line" | "bars";
}) {
  const [open, setOpen] = useState(presentation === "inline");
  const titleId = useId();
  const graph = (
    <SalesExpenseGraphModal
      days={days}
      today={today}
      title={title}
      secondLabel={secondLabel}
      titleId={titleId}
      inline={presentation === "inline"}
      chartKind={chart}
      onClose={() => setOpen(false)}
    />
  );

  if (presentation === "inline") return graph;

  return (
    <>
      <button type="button" className="button" onClick={() => setOpen(true)}>
        <LineChart size={17} />
        View graph
      </button>
      {open ? graph : null}
    </>
  );
}

function SalesExpenseGraphModal({
  days,
  today,
  title,
  secondLabel,
  titleId,
  inline,
  chartKind,
  onClose,
}: {
  days: DailyFlowPoint[];
  today: string;
  title: string;
  secondLabel: string;
  titleId: string;
  inline: boolean;
  chartKind: "line" | "bars";
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [span, setSpan] = useState<GraphSpan>("months");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeSeries, setActiveSeries] = useState<"sales" | "expenses">("sales");
  const svgRef = useRef<SVGSVGElement>(null);
  const series = useMemo(() => graphSpanSeries(days, span, today), [days, span, today]);
  const { points, grain } = series;
  const geometry = chartGeometry(points);
  const active = activeIndex === null ? null : points[activeIndex] ?? null;
  const salesTotal = points.reduce((sum, point) => sum + point.salesCents, 0);
  const expenseTotal = points.reduce((sum, point) => sum + (point.expenseCents ?? 0), 0);
  const expenseKnown = points.some((point) => point.expenseCents !== null);
  const lastExpense = [...days].reverse().find((day) => day.expenseCents !== null)?.isoDate;
  const expenseStopsEarly =
    expenseKnown &&
    lastExpense !== undefined &&
    points.some((point) => point.expenseCents === null && point.isoDate > lastExpense);

  useEffect(() => {
    if (inline) return;
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
  }, [inline, onClose]);

  useEffect(() => {
    setActiveIndex(chartKind === "bars" && points.length > 0 ? points.length - 1 : null);
  }, [span, chartKind, points.length]);

  function hoverAt(event: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const pointer = svg.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const local = pointer.matrixTransform(matrix.inverse());
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    points.forEach((_, index) => {
      const gap = Math.abs(geometry.xAt(index) - local.x);
      if (gap < distance) {
        distance = gap;
        nearest = index;
      }
    });
    const point = points[nearest];
    const salesDistance = Math.abs(geometry.yAt(point?.salesCents ?? 0) - local.y);
    const expenseDistance =
      point?.expenseCents === null
        ? Number.POSITIVE_INFINITY
        : Math.abs(geometry.yAt(point.expenseCents) - local.y);
    setActiveIndex(nearest);
    setActiveSeries(expenseDistance < salesDistance ? "expenses" : "sales");
  }

  const ticks = [geometry.max, geometry.min + (geometry.max - geometry.min) / 2, geometry.min];
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  const chart = (
      <div className={inline ? "panel" : "modal-dialog"} role={inline ? undefined : "dialog"} aria-modal={inline ? undefined : true} aria-labelledby={titleId}>
        <div className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p>
              {chartKind === "bars"
                ? grainCaption(grain).replace("point", "pair of bars")
                : grainCaption(grain)}
              {expenseStopsEarly && lastExpense
                ? ` Recorded through ${formatShortDate(lastExpense)}.`
                : ""}
            </p>
          </div>
          {inline ? null : (
            <button
              ref={closeRef}
              type="button"
              className="icon-button"
              aria-label="Close graph"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className={inline ? "trend-inline-body" : "modal-body"}>
          <div className="trend-legend">
            <span>
              <i className="trend-swatch" style={{ background: SALES_COLOR }} />
              Sales {formatMoney(salesTotal)}
            </span>
            <span>
              <i className="trend-swatch" style={{ background: EXPENSE_COLOR }} />
              {secondLabel} {expenseKnown ? formatMoney(expenseTotal) : "not recorded"}
            </span>
          </div>
          {points.length === 0 ? (
            <p className="trend-empty">No sales or {secondLabel.toLowerCase()} are recorded for these dates.</p>
          ) : chartKind === "bars" ? (
            <div className="trend-chart">
              <GroupedBars
                points={points}
                grain={grain}
                secondLabel={secondLabel}
                activeIndex={activeIndex}
                onSelect={setActiveIndex}
              />
              {active ? (
                <p className="trend-tooltip">
                  <strong>{pointLabel(active.isoDate, grain)}</strong>
                  <span style={{ color: SALES_COLOR }}>Sales {formatMoney(active.salesCents)}</span>
                  <span style={{ color: EXPENSE_COLOR }}>
                    {secondLabel}{" "}
                    {active.expenseCents === null ? "not recorded" : formatMoney(active.expenseCents)}
                  </span>
                </p>
              ) : (
                <p className="trend-tooltip trend-tooltip-hint">Tap a pair of bars to read that date.</p>
              )}
            </div>
          ) : (
            <div className="trend-chart">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${geometry.width} ${geometry.height}`}
                role="img"
                aria-label={`Line graph of sales and ${secondLabel.toLowerCase()}. Sales ${formatMoney(salesTotal)}. ${secondLabel} ${expenseKnown ? formatMoney(expenseTotal) : "not recorded"}.`}
                onMouseLeave={() => setActiveIndex(null)}
                onMouseMove={hoverAt}
              >
                {ticks.map((tick, index) => (
                  <g key={index}>
                    <line
                      x1={geometry.left}
                      x2={geometry.width - geometry.right}
                      y1={geometry.yAt(tick)}
                      y2={geometry.yAt(tick)}
                      className="trend-grid"
                    />
                    <text
                      x={geometry.left - 8}
                      y={geometry.yAt(tick) + 4}
                      textAnchor="end"
                      className="trend-axis"
                    >
                      {axisMoney(tick)}
                    </text>
                  </g>
                ))}
                <path d={linePath(points, "salesCents", geometry)} className="trend-line trend-line-sales" />
                <path
                  d={linePath(points, "expenseCents", geometry)}
                  className="trend-line trend-line-expenses"
                />
                {activeIndex !== null && active ? (
                  <HoverMarker
                    point={active}
                    index={activeIndex}
                    series={activeSeries}
                    grain={grain}
                    geometry={geometry}
                  />
                ) : null}
                {points.map((point, index) => {
                  const last = points.length - 1;
                  const nearEnd = index !== last && last - index < labelStep;
                  if (index !== 0 && index !== last && (index % labelStep !== 0 || nearEnd)) return null;
                  return (
                    <text
                      key={point.isoDate}
                      x={geometry.xAt(index)}
                      y={geometry.height - 12}
                      textAnchor={index === 0 ? "start" : index === last ? "end" : "middle"}
                      className="trend-axis"
                    >
                      {pointLabel(point.isoDate, grain)}
                    </text>
                  );
                })}
              </svg>
              {active ? (
                <p className="trend-tooltip">
                  <strong>{pointLabel(active.isoDate, grain)}</strong>
                  <span style={{ color: SALES_COLOR }}>Sales {formatMoney(active.salesCents)}</span>
                  <span style={{ color: EXPENSE_COLOR }}>
                    {secondLabel}{" "}
                    {active.expenseCents === null ? "not recorded" : formatMoney(active.expenseCents)}
                  </span>
                </p>
              ) : (
                <p className="trend-tooltip trend-tooltip-hint">
                  Move across the lines to read a {grain === "day" ? "day" : grain === "week" ? "week" : "month"}.
                </p>
              )}
            </div>
          )}
          <div className="trend-ranges" role="group" aria-label="Graph range">
            {graphSpans.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`trend-range${span === option.id ? " trend-range-active" : ""}`}
                aria-pressed={span === option.id}
                onClick={() => setSpan(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
  );

  if (inline) return chart;
  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {chart}
    </div>,
    document.body,
  );
}
