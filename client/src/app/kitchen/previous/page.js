"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ordersApi } from "@/lib/api";

// Format a Date as YYYY-MM-DD in local time (avoid UTC/date-shift bugs)
function toLocalDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parse YYYY-MM-DD as local date (not UTC midnight)
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getRangeForPreset(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const copy = (d) => new Date(d.getTime());

  switch (preset) {
    case "today":
      return { start: toLocalDateString(today), end: toLocalDateString(today) };
    case "yesterday": {
      const y = copy(today);
      y.setDate(y.getDate() - 1);
      return { start: toLocalDateString(y), end: toLocalDateString(y) };
    }
    case "lastWeek": {
      const end = copy(today);
      const start = copy(today);
      start.setDate(start.getDate() - 6);
      return { start: toLocalDateString(start), end: toLocalDateString(end) };
    }
    case "lastMonth": {
      const start = copy(today);
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      const end = copy(today);
      end.setDate(0);
      return { start: toLocalDateString(start), end: toLocalDateString(end) };
    }
    case "lastYear": {
      const start = copy(today);
      start.setFullYear(start.getFullYear() - 1);
      start.setMonth(0);
      start.setDate(1);
      const end = copy(today);
      end.setFullYear(end.getFullYear() - 1);
      end.setMonth(11);
      end.setDate(31);
      return { start: toLocalDateString(start), end: toLocalDateString(end) };
    }
    default:
      return null;
  }
}

export default function PreviousKitchenOrders() {
  const todayStr = toLocalDateString(new Date());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [filterPreset, setFilterPreset] = useState("today");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  useEffect(() => {
    loadOrders();
  }, [startDate, endDate, showAll]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await ordersApi.getPreviousKitchenOrders(
        showAll ? null : startDate,
        showAll ? null : endDate,
        showAll
      );
      setOrders(data);
    } catch (error) {
      console.error("Failed to load previous orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getFilterDescription = () => {
    if (startDate === endDate) {
      const d = parseLocalDate(startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (dMidnight.getTime() === today.getTime()) return "Today";
      if (dMidnight.getTime() === yesterday.getTime()) return "Yesterday";
      return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const handlePresetChange = (e) => {
    const preset = e.target.value;
    setFilterPreset(preset);
    setShowAll(false);
    const range = getRangeForPreset(preset);
    if (range) {
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  const handleStartDateChange = (e) => {
    const value = e.target.value;
    setStartDate(value);
    setFilterPreset("");
    setShowAll(false);
    if (value > endDate) setEndDate(value);
  };

  const handleEndDateChange = (e) => {
    const value = e.target.value;
    setEndDate(value);
    setFilterPreset("");
    setShowAll(false);
    if (value < startDate) setStartDate(value);
  };

  const handleShowAll = () => {
    setShowAll(true);
  };

  const handleShowDateFilter = () => {
    setShowAll(false);
  };

  return (
    <div className="min-h-screen bg-[var(--coffee-brown-very-light)]">
      {/* Header */}
      <div className="bg-[var(--coffee-brown)] text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Previous Kitchen Orders</h1>
              <p className="mt-1 text-sm text-white/80">
                View completed and picked up orders
              </p>
            </div>
            <Link
              href="/kitchen"
              className="rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/30"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Date Filter Section */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[var(--coffee-brown)]">
              {showAll ? "All Previous Orders" : "Filter by Date"}
            </h2>
            {showAll ? (
              <button
                onClick={handleShowDateFilter}
                className="rounded-lg bg-[var(--coffee-brown)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--coffee-brown-dark)]"
              >
                Filter by Date
              </button>
            ) : (
              <button
                onClick={handleShowAll}
                className="rounded-lg bg-[var(--lime-green)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--lime-green-dark)]"
              >
                Show All Orders
              </button>
            )}
          </div>
          {!showAll && (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
                <div className="min-w-[10rem]">
                  <label htmlFor="filter-preset" className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                    Quick filter
                  </label>
                  <div className="relative">
                    <select
                      id="filter-preset"
                      value={filterPreset}
                      onChange={handlePresetChange}
                      className="w-full appearance-none rounded-lg border-2 border-[var(--coffee-brown-light)] bg-white px-4 py-2.5 pr-10 text-[var(--coffee-brown)] transition-colors focus:border-[var(--lime-green)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)] focus:ring-opacity-40 cursor-pointer"
                      style={{ accentColor: "var(--lime-green)" }}
                    >
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="lastWeek">Last Week</option>
                      <option value="lastMonth">Last Month</option>
                      <option value="lastYear">Last Year</option>
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--coffee-brown)]" aria-hidden>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="min-w-[10rem]">
                    <label htmlFor="date-start" className="mb-2 block text-sm font-medium text-gray-700">
                      From
                    </label>
                    <input
                      type="date"
                      id="date-start"
                      value={startDate}
                      onChange={handleStartDateChange}
                      max={endDate}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-[var(--coffee-brown)] focus:border-[var(--lime-green)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)]"
                    />
                  </div>
                  <div className="min-w-[10rem]">
                    <label htmlFor="date-end" className="mb-2 block text-sm font-medium text-gray-700">
                      To
                    </label>
                    <input
                      type="date"
                      id="date-end"
                      value={endDate}
                      onChange={handleEndDateChange}
                      min={startDate}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-[var(--coffee-brown)] focus:border-[var(--lime-green)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)]"
                    />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Showing orders: <span className="font-semibold">{getFilterDescription()}</span>
              </p>
            </>
          )}
          {showAll && (
            <p className="text-sm text-gray-600">
              Showing all completed orders from most recent to oldest
            </p>
          )}
        </div>

        {/* Orders Section */}
        <div>
          <h2 className="mb-4 text-2xl font-bold text-[var(--coffee-brown)]">
            Orders ({orders.length})
          </h2>
          {loading ? (
            <div className="rounded-lg bg-white p-12 text-center shadow-md">
              <p className="text-lg text-gray-500">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center shadow-md">
              <p className="text-lg text-gray-500">No orders found for the selected date range</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {orders.map((order) => (
                <OrderCard
                  key={order._id}
                  order={order}
                  formatTime={formatTime}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, formatTime, formatDate }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg bg-white p-6 shadow-lg"
    >
      {/* Order Header */}
      <div className="mb-4 border-b border-gray-200 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-[var(--coffee-brown)]">
              Order #{order._id.toString().slice(-8).toUpperCase()}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {formatDate(order.updatedAt || order.createdAt)} at{" "}
              {formatTime(order.updatedAt || order.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <div className="inline-block rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
              PICKED UP
            </div>
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-4">
        <p className="font-semibold text-[var(--coffee-brown)]">{order.customer.name}</p>
        <p className="text-sm text-gray-600">{order.customer.phone}</p>
        {order.customer.email && (
          <p className="text-sm text-gray-600">{order.customer.email}</p>
        )}
      </div>

      {/* Items */}
      <div className="mb-4">
        <h4 className="mb-2 font-semibold text-[var(--coffee-brown)]">Items:</h4>
        <ul className="space-y-2">
          {order.items.map((item, idx) => (
            <li key={idx} className="text-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span className="font-medium">
                    {item.quantity}x {item.name}
                  </span>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <ul className="ml-4 mt-1 space-y-1 text-gray-600">
                      {item.modifiers.map((modifier, modIdx) => {
                        const isQuantityBasedGroup =
                          (modifier.modifierGroupName || "").includes("Syrup Pumps") ||
                          (modifier.modifierGroupName || "").includes("Pumps") ||
                          (modifier.modifierGroupName || "").includes("Extra Single Shot");
                        const isSyrupPump = (modifier.modifierGroupName || "").includes("Syrup");
                        const rawGroupName = modifier.modifierGroupName || "";
                        let groupDisplayName = rawGroupName.replace(/\s*\(\+?\$[^)]*\)\s*$/g, "").trim() || rawGroupName;
                        if (["Cup Size (12-16)", "Cup Size (16-20)", "Cold Brew Cup Size (16-20)"].includes(rawGroupName)) {
                          groupDisplayName = "Cup Size";
                        }
                        const optionsText = modifier.selectedOptions
                          .map((opt) => {
                            const q = opt.quantity || 1;
                            if (isQuantityBasedGroup) {
                              const baseName = isSyrupPump ? (opt.name || "").replace(/\s+Pump\s*$/i, "").trim() || opt.name : opt.name;
                              const pumpLabel = isSyrupPump ? (q > 1 ? " pumps" : " pump") : "";
                              return `${q} x ${baseName}${pumpLabel}`;
                            }
                            return opt.name;
                          })
                          .join(", ");
                        return (
                          <li key={modIdx} className="text-xs">
                            <span className="font-medium">{groupDisplayName}:</span>{" "}
                            {optionsText}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {item.notes && (
                    <p className="ml-4 mt-1 text-xs italic text-gray-500">Note: {item.notes}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Order Notes */}
      {order.notes && (
        <div className="mb-4 rounded bg-yellow-50 p-2">
          <p className="text-xs font-semibold text-yellow-800">Order Note:</p>
          <p className="text-sm text-yellow-900">{order.notes}</p>
        </div>
      )}

      {/* Pickup Time */}
      {order.pickupTime && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Scheduled Pickup:</span> {formatDate(order.pickupTime)} at{" "}
            {formatTime(order.pickupTime)}
          </p>
        </div>
      )}

      {/* Total */}
      <div className="border-t border-gray-200 pt-3">
        <div className="flex justify-between">
          <span className="font-semibold text-[var(--coffee-brown)]">Total:</span>
          <span className="text-lg font-bold text-[var(--coffee-brown)]">
            ${order.totals.total.toFixed(2)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

