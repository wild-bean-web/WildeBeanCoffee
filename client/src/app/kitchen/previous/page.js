"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ordersApi } from "@/lib/api";

export default function PreviousKitchenOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to today in YYYY-MM-DD format
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  useEffect(() => {
    loadOrders();
  }, [selectedDate, showAll]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await ordersApi.getPreviousKitchenOrders(
        showAll ? null : selectedDate,
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

  const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(dateString);
    selected.setHours(0, 0, 0, 0);

    if (selected.getTime() === today.getTime()) {
      return "Today";
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (selected.getTime() === yesterday.getTime()) {
      return "Yesterday";
    }
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setShowAll(false);
  };

  const setToday = () => {
    const today = new Date();
    setSelectedDate(today.toISOString().split("T")[0]);
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setSelectedDate(yesterday.toISOString().split("T")[0]);
    setShowAll(false);
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label
                    htmlFor="date-picker"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Select Date
                  </label>
                  <input
                    type="date"
                    id="date-picker"
                    value={selectedDate}
                    onChange={handleDateChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-[var(--coffee-brown)] focus:border-[var(--lime-green)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={setToday}
                    className="rounded-lg bg-[var(--lime-green)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--lime-green-dark)]"
                  >
                    Today
                  </button>
                  <button
                    onClick={setYesterday}
                    className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-300"
                  >
                    Yesterday
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Showing orders from: <span className="font-semibold">{formatDateHeader(selectedDate)}</span>
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
              <p className="text-lg text-gray-500">No orders found for this date</p>
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
                      {item.modifiers.map((modifier, modIdx) => (
                        <li key={modIdx} className="text-xs">
                          <span className="font-medium">{modifier.modifierGroupName}:</span>{" "}
                          {modifier.selectedOptions.map((opt) => opt.name).join(", ")}
                        </li>
                      ))}
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

