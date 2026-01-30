"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ordersApi } from "@/lib/api";

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const eventSourceRef = useRef(null);
  const [newOrderIds, setNewOrderIds] = useState(new Set());

  // Separate orders into pending and ready
  const pendingOrders = orders.filter(
    (order) => order.status !== "ready" && order.status !== "completed"
  );
  const readyOrders = orders.filter((order) => order.status === "ready");

  // Load initial orders
  useEffect(() => {
    loadOrders();

    // Set up Server-Sent Events connection
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
    const streamUrl = API_BASE_URL 
      ? `${API_BASE_URL}/api/orders/kitchen/stream`
      : "/api/orders/kitchen/stream";
    const eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
      console.log("SSE connection opened");
      setIsConnected(true);
    };

    eventSource.addEventListener("order:created", (event) => {
      const newOrder = JSON.parse(event.data);
      console.log("New order received:", newOrder);
      setOrders((prev) => [newOrder, ...prev]);
      setNewOrderIds((prev) => new Set([...prev, newOrder._id]));
      setLastUpdate(new Date());
      playNotificationSound();
    });

    eventSource.addEventListener("order:updated", (event) => {
      const updatedOrder = JSON.parse(event.data);
      console.log("Order updated:", updatedOrder);
      setOrders((prev) =>
        prev.map((order) => (order._id === updatedOrder._id ? updatedOrder : order))
      );
      setLastUpdate(new Date());
    });

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      setIsConnected(false);
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSource.close();
          loadOrders();
        }
      }, 3000);
    };

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, []);

  // Remove new order highlight after 5 seconds
  useEffect(() => {
    if (newOrderIds.size > 0) {
      const timer = setTimeout(() => {
        setNewOrderIds(new Set());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [newOrderIds]);

  const loadOrders = async () => {
    try {
      const data = await ordersApi.getKitchenOrders();
      setOrders(data);
    } catch (error) {
      console.error("Failed to load orders:", error);
    }
  };

  const playNotificationSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Frequency in Hz
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log("Could not play notification sound:", error);
    }
  };

  const handleMarkReady = async (orderId) => {
    try {
      await ordersApi.updateStatus(orderId, "ready");
      // The SSE event will update the order automatically
    } catch (error) {
      console.error("Failed to update order status:", error);
      alert("Failed to mark order as ready. Please try again.");
    }
  };

  const handleMarkPickedUp = async (orderId) => {
    try {
      await ordersApi.updateStatus(orderId, "completed");
      // The SSE event will update the order automatically
      // Remove from local state immediately since it won't appear in kitchen orders anymore
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
    } catch (error) {
      console.error("Failed to update order status:", error);
      alert("Failed to mark order as picked up. Please try again.");
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
    });
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 minute ago";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    return `${diffHours} hours ago`;
  };

  return (
    <div className="min-h-screen bg-[var(--coffee-brown-very-light)]">

       {/* Header */}
       <div className="bg-[var(--coffee-brown)] text-white shadow-lg">
         <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
           <div className="flex items-center justify-between">
             <div>
               <h1 className="text-3xl font-bold">Kitchen Dashboard</h1>
               <p className="mt-1 text-sm text-white/80">
                 {isConnected ? (
                   <span className="flex items-center gap-2">
                     <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--lime-green)]"></span>
                     Connected
                   </span>
                 ) : (
                   <span className="text-yellow-300">Reconnecting...</span>
                 )}
               </p>
             </div>
             <div className="flex items-center gap-4">
               <div className="text-right">
                 <p className="text-sm text-white/80">Last updated</p>
                 <p className="text-lg font-semibold">{formatTime(lastUpdate)}</p>
               </div>
               <Link
                 href="/kitchen/previous"
                 className="rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/30"
               >
                 Previous Orders
               </Link>
             </div>
           </div>
         </div>
       </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Ready Orders Section */}
        {readyOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-bold text-[var(--coffee-brown)]">
              Ready for Pickup ({readyOrders.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                 {readyOrders.map((order) => (
                   <OrderCard
                     key={order._id}
                     order={order}
                     isNew={false}
                     formatTime={formatTime}
                     formatDate={formatDate}
                     getTimeAgo={getTimeAgo}
                     isReady={true}
                     onMarkPickedUp={handleMarkPickedUp}
                   />
                 ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Pending Orders Section */}
        <div>
          <h2 className="mb-4 text-2xl font-bold text-[var(--coffee-brown)]">
            Pending Orders ({pendingOrders.length})
          </h2>
          {pendingOrders.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center shadow-md">
              <p className="text-lg text-gray-500">No pending orders</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {pendingOrders.map((order) => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    isNew={newOrderIds.has(order._id)}
                    formatTime={formatTime}
                    formatDate={formatDate}
                    getTimeAgo={getTimeAgo}
                    onMarkReady={handleMarkReady}
                    isReady={false}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  isNew,
  formatTime,
  formatDate,
  getTimeAgo,
  onMarkReady,
  onMarkPickedUp,
  isReady,
}) {
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [isMarkingPickedUp, setIsMarkingPickedUp] = useState(false);

  const handleMarkReadyClick = async () => {
    setIsMarkingReady(true);
    try {
      await onMarkReady(order._id);
    } finally {
      setIsMarkingReady(false);
    }
  };

  const handleMarkPickedUpClick = async () => {
    setIsMarkingPickedUp(true);
    try {
      await onMarkPickedUp(order._id);
    } finally {
      setIsMarkingPickedUp(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={`relative rounded-lg bg-white p-6 shadow-lg ${
        isNew ? "ring-4 ring-[var(--lime-green)] ring-offset-2" : ""
      } ${isReady ? "border-2 border-[var(--lime-green)]" : ""}`}
    >
      {/* New Order Badge */}
      {isNew && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -right-2 -top-2 rounded-full bg-[var(--lime-green)] px-3 py-1 text-xs font-bold text-white shadow-lg"
        >
          NEW
        </motion.div>
      )}

      {/* Order Header */}
      <div className="mb-4 border-b border-gray-200 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-[var(--coffee-brown)]">
              Order #{order._id.toString().slice(-8).toUpperCase()}
            </h3>
            <p className="mt-1 text-sm text-gray-600">{getTimeAgo(order.createdAt)}</p>
          </div>
          <div className="text-right">
            <div
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                isReady
                  ? "bg-[var(--lime-green)] text-white"
                  : order.status === "preparing"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-blue-100 text-blue-800"
              }`}
            >
              {order.status.toUpperCase()}
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
            <span className="font-semibold">Pickup:</span> {formatDate(order.pickupTime)} at{" "}
            {formatTime(order.pickupTime)}
          </p>
        </div>
      )}

      {/* Total */}
      <div className="mb-4 border-t border-gray-200 pt-3">
        <div className="flex justify-between">
          <span className="font-semibold text-[var(--coffee-brown)]">Total:</span>
          <span className="text-lg font-bold text-[var(--coffee-brown)]">
            ${order.totals.total.toFixed(2)}
          </span>
        </div>
      </div>

       {/* Action Buttons */}
       {!isReady && (
         <button
           onClick={handleMarkReadyClick}
           disabled={isMarkingReady}
           className="w-full rounded-lg bg-[var(--lime-green)] px-4 py-3 font-semibold text-white transition-all duration-200 hover:bg-[var(--lime-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
         >
           {isMarkingReady ? "Marking..." : "Mark Ready for Pickup"}
         </button>
       )}

       {isReady && (
         <button
           onClick={handleMarkPickedUpClick}
           disabled={isMarkingPickedUp}
           className="w-full rounded-lg bg-[var(--coffee-brown)] px-4 py-3 font-semibold text-white transition-all duration-200 hover:bg-[var(--coffee-brown-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
         >
           {isMarkingPickedUp ? "Marking..." : "Picked Up"}
         </button>
       )}
    </motion.div>
  );
}

