"use client";

import { useState } from "react";
import { formatMoney, formatPercent } from "@/lib/format";

const CHART_COLORS = [
  "var(--coffee-700)",
  "var(--lime-600)",
  "var(--blue-600)",
  "var(--amber-700)",
  "var(--red-700)",
  "var(--coffee-900)",
  "var(--lime-700)",
  "var(--coffee-800)",
];

export interface ExpenseChartCategory {
  category: string;
  groupLabel: string;
  amountCents: number;
}

function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? "var(--coffee-700)";
}

function slicePath(
  start: number,
  end: number,
  outer: number,
  inner: number,
): string {
  const sweep = end - start;
  if (sweep >= Math.PI * 2 - 0.0001) {
    return [
      `M 100 ${100 - outer}`,
      `A ${outer} ${outer} 0 1 1 100 ${100 + outer}`,
      `A ${outer} ${outer} 0 1 1 100 ${100 - outer}`,
      `M 100 ${100 - inner}`,
      `A ${inner} ${inner} 0 1 0 100 ${100 + inner}`,
      `A ${inner} ${inner} 0 1 0 100 ${100 - inner}`,
    ].join(" ");
  }
  const point = (radius: number, angle: number) => {
    const x = 100 + radius * Math.cos(angle);
    const y = 100 + radius * Math.sin(angle);
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };
  const large = sweep > Math.PI ? 1 : 0;
  return [
    `M ${point(outer, start)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${point(outer, end)}`,
    `L ${point(inner, end)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${point(inner, start)}`,
    "Z",
  ].join(" ");
}

export function ExpenseBreakdown({
  categories,
  totalCents,
}: {
  categories: ExpenseChartCategory[];
  totalCents: number;
}) {
  const [view, setView] = useState<"pie" | "bar">("pie");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const slices = categories.filter((category) => category.amountCents > 0);
  const chartTotal = slices.reduce((sum, category) => sum + category.amountCents, 0);
  const notable = slices.filter(
    (category) => chartTotal > 0 && category.amountCents / chartTotal >= 0.015,
  );
  const smaller = slices.filter(
    (category) => chartTotal <= 0 || category.amountCents / chartTotal < 0.015,
  );
  const chartSlices =
    smaller.length === 0
      ? notable
      : [
          ...notable,
          {
            category: "Other",
            groupLabel:
              new Set(smaller.map((category) => category.groupLabel)).size === 1
                ? `${smaller[0]?.groupLabel ?? "Expenses"} · smaller categories`
                : "Smaller categories",
            amountCents: smaller.reduce((sum, category) => sum + category.amountCents, 0),
          },
        ];
  const largest = slices.reduce(
    (max, category) => Math.max(max, category.amountCents),
    0,
  );

  const circleStart = -Math.PI / 2;
  const seam = 0.02;
  let angle = circleStart;
  const arcs = chartSlices.map((category, index) => {
    const sweep = chartTotal > 0 ? (category.amountCents / chartTotal) * Math.PI * 2 : 0;
    const start = index === 0 ? angle - seam : angle;
    angle += sweep;
    const end = index === chartSlices.length - 1 ? circleStart + Math.PI * 2 + seam : angle + seam;
    return { category, index, start, end };
  });

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Expenses by category</h2>
          <p>
            {slices.length > 0
              ? `${slices.length} categor${slices.length === 1 ? "y" : "ies"} in this view${
                  smaller.length > 0 ? ". Smaller ones are grouped as Other on the chart." : ""
                }`
              : "No expenses in this view"}
          </p>
        </div>
        <div className="expense-view-toggle" role="group" aria-label="Chart type">
          <button
            type="button"
            className={`date-range-preset${view === "pie" ? " date-range-preset-active" : ""}`}
            aria-pressed={view === "pie"}
            onClick={() => {
              setView("pie");
              setActiveIndex(null);
            }}
          >
            Pie chart
          </button>
          <button
            type="button"
            className={`date-range-preset${view === "bar" ? " date-range-preset-active" : ""}`}
            aria-pressed={view === "bar"}
            onClick={() => {
              setView("bar");
              setActiveIndex(null);
            }}
          >
            Bar chart
          </button>
        </div>
      </div>

      {slices.length === 0 ? (
        <p className="expense-empty">Nothing posted in this date range.</p>
      ) : view === "pie" ? (
        <div
          className="expense-pie-layout"
          onMouseLeave={() => setActiveIndex(null)}
        >
          <div className="expense-pie-column">
            <svg
              className="expense-pie"
              viewBox="0 0 200 200"
              role="img"
              aria-label={`Expenses by category, ${formatMoney(totalCents)} total`}
            >
              {arcs.map((arc) => {
                const mid = (arc.start + arc.end) / 2;
                const popped = activeIndex === arc.index;
                const offset = popped ? 9 : 0;
                return (
                  <path
                    key={arc.category.category}
                    className="expense-pie-slice"
                    d={slicePath(arc.start, arc.end, 78, 46)}
                    fill={chartColor(arc.index)}
                    style={{
                      transform: popped
                        ? `translate(${Math.cos(mid) * offset}px, ${Math.sin(mid) * offset}px)`
                        : undefined,
                      opacity: activeIndex === null || popped ? 1 : 0.35,
                    }}
                    onMouseEnter={() => setActiveIndex(arc.index)}
                  >
                    <title>
                      {`${arc.category.category}: ${formatMoney(arc.category.amountCents)}`}
                    </title>
                  </path>
                );
              })}
            </svg>
            <p className="expense-pie-tooltip" role="status">
              {activeIndex !== null && arcs[activeIndex] ? (
                <>
                  <strong>{arcs[activeIndex].category.category}</strong>
                  <span>
                    {formatMoney(arcs[activeIndex].category.amountCents)}
                    {" · "}
                    {formatPercent(
                      chartTotal > 0
                        ? arcs[activeIndex].category.amountCents / chartTotal
                        : null,
                    )}
                  </span>
                </>
              ) : (
                <span className="expense-pie-tooltip-idle"> </span>
              )}
            </p>
          </div>
          <ul className="expense-legend">
            {arcs.map((arc) => {
              const share =
                chartTotal > 0 ? arc.category.amountCents / chartTotal : null;
              const state =
                activeIndex === arc.index
                  ? "is-active"
                  : activeIndex !== null
                    ? "is-dim"
                    : "";
              return (
                <li key={arc.category.category}>
                  <button
                    type="button"
                    className={state}
                    onMouseEnter={() => setActiveIndex(arc.index)}
                    onFocus={() => setActiveIndex(arc.index)}
                    onBlur={(event) => {
                      const next = event.relatedTarget;
                      if (!(next instanceof Node) || !event.currentTarget.closest(".expense-pie-layout")?.contains(next)) {
                        setActiveIndex(null);
                      }
                    }}
                  >
                    <span
                      className="expense-swatch"
                      style={{ background: chartColor(arc.index) }}
                    />
                    <span className="expense-legend-name">
                      <strong>{arc.category.category}</strong>
                      <span>{arc.category.groupLabel}</span>
                    </span>
                    <span className="expense-legend-amount">
                      {formatMoney(arc.category.amountCents)}
                      <span>{formatPercent(share)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <ul className="expense-bars">
          {slices.map((category, index) => (
            <li key={category.category}>
              <div className="expense-bar-label">
                <span>{category.category}</span>
                <span>{formatMoney(category.amountCents)}</span>
              </div>
              <div
                className="expense-bar-track"
                role="img"
                aria-label={`${category.category}, ${formatMoney(category.amountCents)}`}
              >
                <span
                  className="expense-bar-fill"
                  style={{
                    width: `${largest > 0 ? (category.amountCents / largest) * 100 : 0}%`,
                    background: chartColor(index),
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
