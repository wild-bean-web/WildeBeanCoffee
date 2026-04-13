"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ordersApi } from "@/lib/api";
import { BEAN_STAMPS_ENABLED } from "@/lib/loyaltyConstants";

function estimateTotalFromDraft(draft) {
  if (!draft?.items || !Array.isArray(draft.items)) return null;
  let food = 0;
  for (const it of draft.items) {
    food += Number(it.price || 0) * Math.max(1, Number(it.quantity || 1));
  }
  const tax = food * Number(draft.taxRate || 0);
  const tip = Number(draft.tip || 0);
  return food + tax + tip;
}

function checkoutAlertDisplayTotal(alert) {
  const draft = alert?.orderDraft;
  if (draft?.totals?.total != null && !Number.isNaN(Number(draft.totals.total))) {
    return Number(draft.totals.total);
  }
  const est = estimateTotalFromDraft(draft);
  if (est != null) return est;
  if (alert?.amountCents != null) return alert.amountCents / 100;
  return null;
}

function formatDraftItemsForKitchen(items) {
  if (!items?.length) {
    return <p className="text-sm text-gray-500">No line items in saved draft</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="text-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="font-medium">
                {item.quantity}x {item.name}
              </span>
              {(item.modifiers || []).length > 0 && (
                <span className="text-gray-600">
                  {" "}
                  —{" "}
                  {(item.modifiers || [])
                    .map((m) => (m.selectedOptions || []).map((o) => o.name).join(", "))
                    .join("; ")}
                </span>
              )}
              {item.notes && (
                <p className="mt-0.5 text-xs italic text-gray-500">Note: {item.notes}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** lastPlacementError is often `reason — ${JSON.stringify(result)}`; show result.message when present. */
function humanizeCheckoutPlacementError(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  const sep = " — ";
  const idx = s.indexOf(sep);
  if (idx === -1) return s;
  const jsonPart = s.slice(idx + sep.length).trim();
  try {
    const parsed = JSON.parse(jsonPart);
    if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
    if (Array.isArray(parsed?.errors) && parsed.errors.length) {
      return parsed.errors.map((e) => String(e)).join("; ");
    }
  } catch {
    /* ignore */
  }
  return s;
}

const FORCE_RESOLVE_CHECKOUT_CONFIRM =
  "Are you sure this order has been resolved?\n\n" +
  "This will create the paid order on the kitchen board (skipping pickup-time and online-only menu checks) and remove this checkout alert. " +
  "Only continue if the guest was taken care of or you handled it another way.";

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const eventSourceRef = useRef(null);
  const [newOrderIds, setNewOrderIds] = useState(new Set());
  const [isReadyCollapsed, setIsReadyCollapsed] = useState(false);
  const [isPendingCollapsed, setIsPendingCollapsed] = useState(false);
  const [isCheckoutIssuesCollapsed, setIsCheckoutIssuesCollapsed] = useState(false);
  const [checkoutAlerts, setCheckoutAlerts] = useState([]);
  const [checkoutIssueModal, setCheckoutIssueModal] = useState(null);
  const [newCheckoutAlertSessions, setNewCheckoutAlertSessions] = useState(
    () => new Set(),
  );
  const [checkoutRetryBusyId, setCheckoutRetryBusyId] = useState(null);
  const [checkoutForceBusyId, setCheckoutForceBusyId] = useState(null);
  const checkoutAlertsInitRef = useRef(false);
  const prevCheckoutAlertIdsRef = useRef(new Set());

  // New order alert modal (pops up center screen, alarm loops until dismissed)
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const alarmIntervalRef = useRef(null);

  // Audio state
  const audioContextRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(() => {
    // Check localStorage for user preference
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kitchen-audio-enabled");
      return saved !== null ? saved === "true" : true; // Default to enabled
    }
    return true;
  });
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [audioError, setAudioError] = useState(null);

  // Separate orders into pending and ready
  const pendingOrders = orders.filter(
    (order) => order.status !== "ready" && order.status !== "completed"
  );
  const readyOrders = orders.filter((order) => order.status === "ready");

  // Initialize audio on first user interaction if enabled
  useEffect(() => {
    if (audioEnabled && !audioInitialized) {
      // Try to initialize on any user interaction
      const handleUserInteraction = async () => {
        await initializeAudio();
        // Remove listeners after first interaction
        document.removeEventListener("click", handleUserInteraction);
        document.removeEventListener("touchstart", handleUserInteraction);
        document.removeEventListener("keydown", handleUserInteraction);
      };

      document.addEventListener("click", handleUserInteraction, { once: true });
      document.addEventListener("touchstart", handleUserInteraction, { once: true });
      document.addEventListener("keydown", handleUserInteraction, { once: true });

      return () => {
        document.removeEventListener("click", handleUserInteraction);
        document.removeEventListener("touchstart", handleUserInteraction);
        document.removeEventListener("keydown", handleUserInteraction);
      };
    }
  }, [audioEnabled, audioInitialized]);

  // Cleanup audio context and alarm on unmount
  useEffect(() => {
    return () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
    };
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const data = await ordersApi.getKitchenOrders();
      setOrders(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to load orders:", error);
    }
  }, []);

  const loadCheckoutAlerts = useCallback(async () => {
    try {
      const data = await ordersApi.getKitchenCheckoutAlerts();
      setCheckoutAlerts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load checkout alerts:", error);
    }
  }, []);

  const refreshKitchen = useCallback(async () => {
    await loadOrders();
    await loadCheckoutAlerts();
  }, [loadOrders, loadCheckoutAlerts]);

  // Load initial orders + SSE for live updates
  useEffect(() => {
    loadOrders();
    loadCheckoutAlerts();

    // Set up Server-Sent Events connection (token in URL; EventSource cannot send headers)
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
    const base = API_BASE_URL ? `${API_BASE_URL}/api/orders/kitchen/stream` : "/api/orders/kitchen/stream";
    const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    const streamUrl = token ? `${base}?token=${encodeURIComponent(token)}` : base;
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
      setNewOrderAlert(newOrder);
      startAlarmLoop();
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
  }, [loadOrders]);

  // Full refresh every 5 minutes so missed SSE events or stale state self-heal
  useEffect(() => {
    const id = setInterval(() => {
      loadOrders();
      loadCheckoutAlerts();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadOrders, loadCheckoutAlerts]);

  // Poll checkout issues more often than full order list (no SSE for drafts)
  useEffect(() => {
    const id = setInterval(loadCheckoutAlerts, 45 * 1000);
    return () => clearInterval(id);
  }, [loadCheckoutAlerts]);

  // Remove new order highlight after 5 seconds
  useEffect(() => {
    if (newOrderIds.size > 0) {
      const timer = setTimeout(() => {
        setNewOrderIds(new Set());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [newOrderIds]);

  // Initialize audio context (requires user interaction)
  const initializeAudio = async () => {
    if (audioContextRef.current) {
      return audioContextRef.current;
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        throw new Error("Web Audio API not supported");
      }

      const context = new AudioContext();
      
      // Resume context if suspended (required for some browsers)
      if (context.state === "suspended") {
        await context.resume();
      }

      audioContextRef.current = context;
      setAudioInitialized(true);
      setAudioError(null);
      return context;
    } catch (error) {
      console.error("Failed to initialize audio:", error);
      setAudioError("Audio not available. Please enable audio permissions.");
      return null;
    }
  };

  // Enable audio (requires user interaction)
  const handleEnableAudio = async () => {
    const context = await initializeAudio();
    if (context) {
      setAudioEnabled(true);
      localStorage.setItem("kitchen-audio-enabled", "true");
      // Play a test sound to confirm it works
      playNotificationSound();
    }
  };

  const handleDeclineSound = () => {
    setAudioEnabled(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("kitchen-audio-enabled", "false");
    }
  };

  // Toggle audio on/off
  const toggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    localStorage.setItem("kitchen-audio-enabled", newState.toString());
    
    if (newState && !audioInitialized) {
      // Try to initialize if enabling
      handleEnableAudio();
    }
  };

  const playNotificationSound = () => {
    if (!audioEnabled) {
      return;
    }

    try {
      const context = audioContextRef.current;
      
      // If context not initialized, try to initialize (may fail without user interaction)
      if (!context) {
        initializeAudio().then((ctx) => {
          if (ctx) {
            playSound(ctx);
          }
        });
        return;
      }

      // Resume context if suspended
      if (context.state === "suspended") {
        context.resume().then(() => {
          playSound(context);
        }).catch((error) => {
          console.log("Could not resume audio context:", error);
          setAudioError("Audio blocked. Click 'Enable Sounds' to allow.");
        });
        return;
      }

      playSound(context);
    } catch (error) {
      console.log("Could not play notification sound:", error);
      setAudioError("Failed to play sound");
    }
  };

  const playSound = (context) => {
    try {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.frequency.value = 800; // Frequency in Hz
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.3);
    } catch (error) {
      console.error("Error playing sound:", error);
    }
  };

  // Loud two-tone alarm for new order (like order printer alarms)
  const playAlarmSound = (context) => {
    try {
      const now = context.currentTime;
      const osc1 = context.createOscillator();
      const osc2 = context.createOscillator();
      const gainNode = context.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(context.destination);

      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(660, now + 0.15);
      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(660, now + 0.15);
      osc1.type = "sine";
      osc2.type = "sine";

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.5, now + 0.02);
      gainNode.gain.setValueAtTime(0.5, now + 0.28);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } catch (error) {
      console.error("Error playing alarm:", error);
    }
  };

  const startAlarmLoop = () => {
    if (!audioEnabled) return;
    stopAlarmLoop();
    const context = audioContextRef.current;
    if (!context) {
      initializeAudio().then((ctx) => {
        if (ctx) {
          playAlarmSound(ctx);
          alarmIntervalRef.current = setInterval(() => {
            if (audioContextRef.current && audioContextRef.current.state === "running") {
              playAlarmSound(audioContextRef.current);
            }
          }, 1200);
        }
      });
      return;
    }
    if (context.state === "suspended") {
      context.resume().then(() => {
        playAlarmSound(context);
        alarmIntervalRef.current = setInterval(() => playAlarmSound(context), 1200);
      });
      return;
    }
    playAlarmSound(context);
    alarmIntervalRef.current = setInterval(() => playAlarmSound(context), 1200);
  };

  const stopAlarmLoop = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  };

  const dismissNewOrderAlert = () => {
    stopAlarmLoop();
    setNewOrderAlert(null);
  };

  const dismissCheckoutIssueModal = () => {
    stopAlarmLoop();
    setCheckoutIssueModal(null);
  };

  useEffect(() => {
    const ids = new Set(checkoutAlerts.map((a) => a.checkoutSessionId));
    if (!checkoutAlertsInitRef.current) {
      checkoutAlertsInitRef.current = true;
      prevCheckoutAlertIdsRef.current = ids;
      return;
    }
    const prev = prevCheckoutAlertIdsRef.current;
    const newOnes = checkoutAlerts.filter((a) => !prev.has(a.checkoutSessionId));
    prevCheckoutAlertIdsRef.current = ids;
    if (newOnes.length === 0) return;

    setIsCheckoutIssuesCollapsed(false);
    setNewCheckoutAlertSessions((s) => {
      const next = new Set(s);
      newOnes.forEach((n) => next.add(n.checkoutSessionId));
      return next;
    });
    window.setTimeout(() => {
      setNewCheckoutAlertSessions((s) => {
        const next = new Set(s);
        newOnes.forEach((n) => next.delete(n.checkoutSessionId));
        return next;
      });
    }, 8000);
    playNotificationSound();
    startAlarmLoop();
    setCheckoutIssueModal((cur) => cur || newOnes[0]);
  }, [checkoutAlerts]);

  const handleRetryCheckoutOrder = async (checkoutSessionId) => {
    setCheckoutRetryBusyId(checkoutSessionId);
    try {
      await ordersApi.recoverHostedCheckout(checkoutSessionId);
      dismissCheckoutIssueModal();
      await loadCheckoutAlerts();
      await loadOrders();
    } catch (err) {
      alert(err.message || "Could not create order from checkout. Try again or use Clover.");
    } finally {
      setCheckoutRetryBusyId(null);
    }
  };

  const checkoutActionBusy = (checkoutSessionId) =>
    checkoutRetryBusyId === checkoutSessionId ||
    checkoutForceBusyId === checkoutSessionId;

  const handleForceResolveCheckoutOrder = async (checkoutSessionId) => {
    if (!window.confirm(FORCE_RESOLVE_CHECKOUT_CONFIRM)) return;
    setCheckoutForceBusyId(checkoutSessionId);
    try {
      await ordersApi.forceResolveHostedCheckout(checkoutSessionId);
      dismissCheckoutIssueModal();
      await loadCheckoutAlerts();
      await loadOrders();
    } catch (err) {
      alert(
        err.message ||
          "Could not force-create the order. Check the error, try normal retry, or use Clover.",
      );
    } finally {
      setCheckoutForceBusyId(null);
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

  /** Bean Stamps: refunds do not remove stamps (per program rules). */
  const handleMarkRefunded = async (orderId) => {
    if (
      !window.confirm(
        "Record refund for this order? Bean Stamps earned for this order will NOT be removed.",
      )
    ) {
      return;
    }
    try {
      await ordersApi.updateStatus(orderId, { paymentStatus: "refunded" });
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
    } catch (error) {
      console.error("Failed to mark refunded:", error);
      alert("Failed to record refund. Please try again.");
    }
  };

  /** Bean Stamps: cancel revokes stamp tied to this order. */
  const handleMarkCancelledLoyalty = async (orderId) => {
    if (
      !window.confirm(
        "Cancel this order? Any Bean Stamp earned from this order will be removed from the customer’s card.",
      )
    ) {
      return;
    }
    try {
      await ordersApi.updateStatus(orderId, { status: "cancelled" });
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
    } catch (error) {
      console.error("Failed to cancel order:", error);
      alert("Failed to cancel order. Please try again.");
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

       {/* New order alert modal - center screen, alarm loops until dismissed */}
       <AnimatePresence>
         {newOrderAlert && (
           <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
             onClick={(e) => e.target === e.currentTarget && dismissNewOrderAlert()}
           >
             <motion.div
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               transition={{ type: "spring", damping: 25, stiffness: 300 }}
               onClick={(e) => e.stopPropagation()}
               className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-4 ring-[var(--lime-green)] overflow-hidden"
             >
               <div className="bg-[var(--lime-green)] px-6 py-4 text-center">
                 <h2 className="text-xl font-bold text-white">New order</h2>
                 <p className="text-sm text-white/90 mt-0.5">
                   Order #{newOrderAlert._id.toString().slice(-8).toUpperCase()}
                 </p>
               </div>
               <div className="max-h-[60vh] overflow-y-auto p-6">
                 <div className="mb-4">
                   <p className="font-semibold text-[var(--coffee-brown)]">{newOrderAlert.customer?.name}</p>
                   <p className="text-sm text-gray-600">{newOrderAlert.customer?.phone}</p>
                   {newOrderAlert.customer?.email && (
                     <p className="text-sm text-gray-600">{newOrderAlert.customer.email}</p>
                   )}
                 </div>
                 <div className="mb-4">
                   <h4 className="mb-2 font-semibold text-[var(--coffee-brown)]">Items</h4>
                   <ul className="space-y-1.5 text-sm">
                     {(newOrderAlert.items || []).map((item, idx) => (
                       <li key={idx}>
                         <span className="font-medium">{item.quantity}x {item.name}</span>
                         {(item.modifiers || []).length > 0 && (
                           <span className="text-gray-600 ml-1">
                             — {(item.modifiers || []).map((m) => (m.selectedOptions || []).map((o) => o.name).join(", ")).join("; ")}
                           </span>
                         )}
                       </li>
                     ))}
                   </ul>
                 </div>
                 {newOrderAlert.notes && (
                   <div className="mb-4 rounded-lg bg-amber-50 p-2">
                     <p className="text-xs font-semibold text-amber-800">Note</p>
                     <p className="text-sm text-amber-900">{newOrderAlert.notes}</p>
                   </div>
                 )}
                 <div className="flex justify-between border-t border-gray-200 pt-3">
                   <span className="font-semibold text-[var(--coffee-brown)]">Total</span>
                   <span className="text-lg font-bold text-[var(--coffee-brown)]">
                     ${newOrderAlert.totals?.total?.toFixed(2) ?? "0.00"}
                   </span>
                 </div>
               </div>
               <div className="p-6 pt-0">
                 <button
                   type="button"
                   onClick={dismissNewOrderAlert}
                   className="w-full rounded-xl bg-[var(--coffee-brown)] px-6 py-4 text-lg font-bold text-white transition-all hover:bg-[var(--coffee-brown-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)] focus:ring-offset-2"
                 >
                   Got it — stop alarm
                 </button>
               </div>
             </motion.div>
           </motion.div>
         )}
       </AnimatePresence>

       {/* Checkout issue alert (paid draft missing kitchen order or placement failed) */}
       <AnimatePresence>
         {checkoutIssueModal && (
           <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
             onClick={(e) => e.target === e.currentTarget && dismissCheckoutIssueModal()}
           >
             <motion.div
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               transition={{ type: "spring", damping: 25, stiffness: 300 }}
               onClick={(e) => e.stopPropagation()}
               className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-4 ring-amber-400 overflow-hidden"
             >
               <div className="bg-amber-500 px-6 py-4 text-center">
                 <h2 className="text-xl font-bold text-white">Checkout issue</h2>
                 <p className="text-sm text-white/90 mt-0.5">
                   Session{" "}
                   {String(checkoutIssueModal.checkoutSessionId || "")
                     .slice(-8)
                     .toUpperCase()}
                 </p>
                {checkoutIssueModal.paymentApprovedAt && (
                  <span className="mt-1 inline-flex rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Payment confirmed
                  </span>
                )}
                 <p className="text-xs text-white/85 mt-1">
                   {checkoutIssueModal.alertKind === "placement_failed"
                     ? "Order creation failed after payment — retry or use Clover."
                     : "Paid checkout with no kitchen order yet — retry sync."}
                 </p>
               </div>
               <div className="max-h-[60vh] overflow-y-auto p-6">
                 {checkoutIssueModal.lastPlacementError && (
                   <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                     <p className="text-xs font-semibold text-red-800">Last error</p>
                     <p className="text-sm text-red-900">
                       {humanizeCheckoutPlacementError(checkoutIssueModal.lastPlacementError)}
                     </p>
                   </div>
                 )}
                 <div className="mb-4">
                   <p className="font-semibold text-[var(--coffee-brown)]">
                     {checkoutIssueModal.orderDraft?.customer?.name || "Customer"}
                   </p>
                   <p className="text-sm text-gray-600">
                     {checkoutIssueModal.orderDraft?.customer?.phone || "—"}
                   </p>
                   {checkoutIssueModal.orderDraft?.customer?.email && (
                     <p className="text-sm text-gray-600">
                       {checkoutIssueModal.orderDraft.customer.email}
                     </p>
                   )}
                 </div>
                 <div className="mb-4">
                   <h4 className="mb-2 font-semibold text-[var(--coffee-brown)]">Make this order</h4>
                   {formatDraftItemsForKitchen(checkoutIssueModal.orderDraft?.items)}
                 </div>
                 {checkoutIssueModal.orderDraft?.notes && (
                   <div className="mb-4 rounded-lg bg-amber-50 p-2">
                     <p className="text-xs font-semibold text-amber-800">Order note</p>
                     <p className="text-sm text-amber-900">{checkoutIssueModal.orderDraft.notes}</p>
                   </div>
                 )}
                 {checkoutIssueModal.orderDraft?.pickupTime && (
                   <div className="mb-4">
                     <p className="text-sm text-gray-600">
                       <span className="font-semibold">Pickup:</span>{" "}
                       {formatDate(checkoutIssueModal.orderDraft.pickupTime)} at{" "}
                       {formatTime(checkoutIssueModal.orderDraft.pickupTime)}
                     </p>
                   </div>
                 )}
                 <div className="flex justify-between border-t border-gray-200 pt-3">
                   <span className="font-semibold text-[var(--coffee-brown)]">Total</span>
                   <span className="text-lg font-bold text-[var(--coffee-brown)]">
                     {(() => {
                       const t = checkoutAlertDisplayTotal(checkoutIssueModal);
                       return t != null ? `$${t.toFixed(2)}` : "—";
                     })()}
                   </span>
                 </div>
                 <p className="mt-4 text-xs text-gray-600">
                   If normal retry fails because pickup is in the past or the store was closed
                   for that slot, use force create after you have handled the guest.
                 </p>
               </div>
               <div className="flex flex-col gap-2 p-6 pt-0">
                 <button
                   type="button"
                   onClick={() =>
                     handleRetryCheckoutOrder(checkoutIssueModal.checkoutSessionId)
                   }
                   disabled={checkoutActionBusy(checkoutIssueModal.checkoutSessionId)}
                   className="w-full rounded-xl bg-[var(--lime-green)] px-6 py-3 text-base font-bold text-white transition-all hover:bg-[var(--lime-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                 >
                   {checkoutRetryBusyId === checkoutIssueModal.checkoutSessionId
                     ? "Creating order…"
                     : "Retry — create kitchen order"}
                 </button>
                 <button
                   type="button"
                   onClick={() =>
                     handleForceResolveCheckoutOrder(
                       checkoutIssueModal.checkoutSessionId,
                     )
                   }
                   disabled={checkoutActionBusy(checkoutIssueModal.checkoutSessionId)}
                   className="w-full rounded-xl border-2 border-amber-600 bg-amber-50 px-6 py-3 text-base font-bold text-amber-950 transition-all hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                 >
                   {checkoutForceBusyId === checkoutIssueModal.checkoutSessionId
                     ? "Force creating…"
                     : "Force create order and clear alert…"}
                 </button>
                 <button
                   type="button"
                   onClick={dismissCheckoutIssueModal}
                   className="w-full rounded-xl bg-[var(--coffee-brown)] px-6 py-3 text-base font-bold text-white transition-all hover:bg-[var(--coffee-brown-dark)] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                 >
                   Got it — stop alarm
                 </button>
               </div>
             </motion.div>
           </motion.div>
         )}
       </AnimatePresence>

       {/* Header */}
       <div className="bg-[var(--coffee-brown)] text-white shadow-lg">
         <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
           {/* Mobile/tablet Layout: Stacked (screens under 900px) */}
           <div className="flex flex-col gap-4 min-[900px]:hidden">
             {/* Title and Status */}
             <div>
               <h1 className="text-2xl font-bold">Kitchen Dashboard</h1>
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
             
             {/* Last Updated, Refresh, and Test Sound */}
             <div className="flex items-center justify-between gap-3">
               <div>
                 <p className="text-xs text-white/80">Last updated</p>
                 <p className="text-base font-semibold">{formatTime(lastUpdate)}</p>
               </div>
               <div className="flex flex-col gap-2">
                 <button
                   onClick={refreshKitchen}
                   className="rounded-lg bg-white/20 px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/30 flex items-center justify-center gap-2 w-full min-w-[7rem]"
                   title="Refresh orders and checkout issues"
                 >
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                   </svg>
                   Refresh
                 </button>
                 <button
                   type="button"
                   onClick={() => playNotificationSound()}
                   disabled={!audioEnabled}
                   className="rounded-lg bg-white/20 px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full min-w-[7rem] disabled:hover:bg-white/20"
                   title="Play test sound"
                 >
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                   </svg>
                   Test sound
                 </button>
               </div>
             </div>

             {/* Audio Control and Previous Orders */}
             <div className="flex flex-col gap-2">
               {/* Audio Toggle */}
               {!audioInitialized && !audioEnabled ? (
                 <button
                   onClick={handleEnableAudio}
                   className="w-full rounded-lg bg-[var(--lime-green)] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--lime-green-dark)] flex items-center justify-center gap-2"
                 >
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                   </svg>
                   Enable Sound Alerts
                 </button>
               ) : (
                 <button
                   onClick={toggleAudio}
                   className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                     audioEnabled
                       ? "bg-[var(--lime-green)] text-white hover:bg-[var(--lime-green-dark)]"
                       : "bg-white/10 text-white/60 hover:bg-white/15"
                   }`}
                 >
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     {audioEnabled ? (
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                     ) : (
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                     )}
                   </svg>
                   {audioEnabled ? "Sounds: On" : "Sounds: Off"}
                 </button>
               )}
               
               {/* Previous Orders + checkout health */}
               <Link
                 href="/kitchen/previous"
                 className="w-full rounded-lg bg-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/30 text-center"
               >
                 Previous Orders
               </Link>
             </div>
           </div>

           {/* Desktop Layout: Horizontal (screens ≥ 900px) */}
           <div className="hidden min-[900px]:flex min-[900px]:items-center min-[900px]:justify-between">
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
             <div className="flex items-center gap-3">
               <div className="text-right">
                 <p className="text-sm text-white/80">Last updated</p>
                 <p className="text-lg font-semibold">{formatTime(lastUpdate)}</p>
               </div>
               
               {/* Audio Toggle */}
               {!audioInitialized && !audioEnabled ? (
                 <button
                   onClick={handleEnableAudio}
                   className="rounded-lg bg-[var(--lime-green)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--lime-green-dark)] flex items-center gap-2"
                   title="Enable sound alerts"
                 >
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                   </svg>
                   Enable Sounds
                 </button>
               ) : (
                 <button
                   onClick={toggleAudio}
                   className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                     audioEnabled
                       ? "bg-[var(--lime-green)] text-white hover:bg-[var(--lime-green-dark)]"
                       : "bg-white/10 text-white/60 hover:bg-white/15"
                   }`}
                   title={audioEnabled ? "Disable sound alerts" : "Enable sound alerts"}
                 >
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     {audioEnabled ? (
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                     ) : (
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                     )}
                   </svg>
                   {audioEnabled ? "Sounds On" : "Sounds Off"}
                 </button>
               )}

               <div className="flex flex-col gap-2">
                 <button
                   onClick={refreshKitchen}
                   className="rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/30 flex items-center gap-2"
                   title="Refresh orders and checkout issues"
                 >
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                   </svg>
                   Refresh
                 </button>
                 <button
                   type="button"
                   onClick={() => playNotificationSound()}
                   disabled={!audioEnabled}
                   className="rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 disabled:hover:bg-white/20"
                   title="Play test sound"
                 >
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                   </svg>
                   Test sound
                 </button>
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

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Ready Orders Section */}
        {readyOrders.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => setIsReadyCollapsed(!isReadyCollapsed)}
              className="mb-4 flex w-full items-center gap-2 text-left hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-bold text-[var(--coffee-brown)]">
                Ready for Pickup ({readyOrders.length})
              </h2>
              <Image
                src={isReadyCollapsed ? "/images/icons/caret-double-down.svg" : "/images/icons/caret-double-up.svg"}
                alt={isReadyCollapsed ? "Expand" : "Collapse"}
                width={24}
                height={24}
                className="h-6 w-6"
              />
            </button>
            {!isReadyCollapsed && (
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
                      onMarkRefunded={
                        BEAN_STAMPS_ENABLED ? handleMarkRefunded : undefined
                      }
                      onMarkCancelledLoyalty={
                        BEAN_STAMPS_ENABLED
                          ? handleMarkCancelledLoyalty
                          : undefined
                      }
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Pending Orders Section */}
        <div className="mb-8">
          <button
            onClick={() => setIsPendingCollapsed(!isPendingCollapsed)}
            className="mb-4 flex w-full items-center gap-2 text-left hover:opacity-80 transition-opacity"
          >
            <h2 className="text-2xl font-bold text-[var(--coffee-brown)]">
              Pending Orders ({pendingOrders.length})
            </h2>
            <Image
              src={isPendingCollapsed ? "/images/icons/caret-double-down.svg" : "/images/icons/caret-double-up.svg"}
              alt={isPendingCollapsed ? "Expand" : "Collapse"}
              width={24}
              height={24}
              className="h-6 w-6"
            />
          </button>
          {!isPendingCollapsed && (
            <>
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
                        onMarkRefunded={
                          BEAN_STAMPS_ENABLED ? handleMarkRefunded : undefined
                        }
                        onMarkCancelledLoyalty={
                          BEAN_STAMPS_ENABLED
                            ? handleMarkCancelledLoyalty
                            : undefined
                        }
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>

        {/* Checkout issues (hosted checkout drafts that need attention) — last so primary work stays on top */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setIsCheckoutIssuesCollapsed(!isCheckoutIssuesCollapsed)}
            className="mb-4 flex w-full items-center gap-2 text-left hover:opacity-80 transition-opacity"
          >
            <h2 className="text-2xl font-bold text-[var(--coffee-brown)]">
              Checkout issues ({checkoutAlerts.length})
            </h2>
            <Image
              src={
                isCheckoutIssuesCollapsed
                  ? "/images/icons/caret-double-down.svg"
                  : "/images/icons/caret-double-up.svg"
              }
              alt={isCheckoutIssuesCollapsed ? "Expand" : "Collapse"}
              width={24}
              height={24}
              className="h-6 w-6"
            />
          </button>
          {!isCheckoutIssuesCollapsed && (
            <>
              {checkoutAlerts.length === 0 ? (
                <div className="rounded-lg bg-white p-8 text-center shadow-md">
                  <p className="text-gray-500">No checkout issues</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {checkoutAlerts.map((alert) => {
                    const draft = alert.orderDraft || {};
                    const sid = String(alert.checkoutSessionId || "");
                    const shortId = sid.slice(-8).toUpperCase();
                    const isNew = newCheckoutAlertSessions.has(alert.checkoutSessionId);
                    const total = checkoutAlertDisplayTotal(alert);
                    return (
                      <motion.div
                        key={alert.checkoutSessionId}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`relative rounded-lg bg-white p-6 shadow-lg ${
                          isNew ? "ring-4 ring-amber-400 ring-offset-2" : ""
                        } border border-amber-100`}
                      >
                        {isNew && (
                          <div className="absolute -right-2 -top-2 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                            NEW
                          </div>
                        )}
                        <div className="mb-3 border-b border-gray-200 pb-3">
                          <h3 className="text-lg font-bold text-[var(--coffee-brown)]">
                            Checkout · {shortId}
                          </h3>
                          {alert.paymentApprovedAt && (
                            <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                              Payment confirmed
                            </span>
                          )}
                          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                            {alert.alertKind === "placement_failed"
                              ? "Placement failed"
                              : "Paid — no kitchen order yet"}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">{getTimeAgo(alert.createdAt)}</p>
                        </div>
                        {alert.lastPlacementError && (
                          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2">
                            <p className="text-xs font-semibold text-red-800">Error</p>
                            <p className="text-sm text-red-900">
                              {humanizeCheckoutPlacementError(alert.lastPlacementError)}
                            </p>
                          </div>
                        )}
                        <div className="mb-3">
                          <p className="font-semibold text-[var(--coffee-brown)]">
                            {draft.customer?.name || "Customer"}
                          </p>
                          <p className="text-sm text-gray-600">{draft.customer?.phone || "—"}</p>
                        </div>
                        <div className="mb-3">
                          <h4 className="mb-1 text-sm font-semibold text-[var(--coffee-brown)]">Items</h4>
                          <div className="max-h-40 overflow-y-auto pr-1">
                            {formatDraftItemsForKitchen(draft.items)}
                          </div>
                        </div>
                        {draft.pickupTime && (
                          <p className="mb-3 text-sm text-gray-600">
                            <span className="font-semibold">Pickup:</span>{" "}
                            {formatDate(draft.pickupTime)} at {formatTime(draft.pickupTime)}
                          </p>
                        )}
                        <div className="mb-4 flex justify-between border-t border-gray-200 pt-3">
                          <span className="font-semibold text-[var(--coffee-brown)]">Total</span>
                          <span className="text-lg font-bold text-[var(--coffee-brown)]">
                            {total != null ? `$${total.toFixed(2)}` : "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setCheckoutIssueModal(alert)}
                            className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                          >
                            Open full ticket
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRetryCheckoutOrder(alert.checkoutSessionId)}
                            disabled={checkoutActionBusy(alert.checkoutSessionId)}
                            className="w-full rounded-lg bg-[var(--lime-green)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--lime-green-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {checkoutRetryBusyId === alert.checkoutSessionId
                              ? "Creating order…"
                              : "Retry — create kitchen order"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleForceResolveCheckoutOrder(alert.checkoutSessionId)
                            }
                            disabled={checkoutActionBusy(alert.checkoutSessionId)}
                            className="w-full rounded-lg border-2 border-amber-600 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {checkoutForceBusyId === alert.checkoutSessionId
                              ? "Force creating…"
                              : "Force create order and clear alert…"}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
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
  onMarkRefunded,
  onMarkCancelledLoyalty,
}) {
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [isMarkingPickedUp, setIsMarkingPickedUp] = useState(false);
  const [loyaltyBusy, setLoyaltyBusy] = useState(false);

  const showLoyaltyActions =
    order.paymentStatus === "paid" &&
    order.status !== "cancelled" &&
    onMarkRefunded &&
    onMarkCancelledLoyalty;

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

       {showLoyaltyActions && (
         <div className="mt-3 space-y-2 border-t border-dashed border-gray-200 pt-3">
           <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
             Bean Stamps / refunds
           </p>
           <div className="flex flex-wrap gap-2">
             <button
               type="button"
               disabled={loyaltyBusy}
               onClick={async () => {
                 setLoyaltyBusy(true);
                 try {
                   await onMarkRefunded(order._id);
                 } finally {
                   setLoyaltyBusy(false);
                 }
               }}
               className="rounded-lg border border-amber-600 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
             >
               Record refund
             </button>
             <button
               type="button"
               disabled={loyaltyBusy}
               onClick={async () => {
                 setLoyaltyBusy(true);
                 try {
                   await onMarkCancelledLoyalty(order._id);
                 } finally {
                   setLoyaltyBusy(false);
                 }
               }}
               className="rounded-lg border border-red-600 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
             >
               Cancel order (remove stamp)
             </button>
           </div>
         </div>
       )}
    </motion.div>
  );
}

