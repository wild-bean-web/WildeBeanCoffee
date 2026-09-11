"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { isKitchenAdminEmail } from "@/lib/kitchenAdmin";
import {
  getKitchenAudioEnabled,
  KITCHEN_AUDIO_CHANGED_EVENT,
} from "@/lib/kitchenAudioPreference";

function playAlarmSound(context) {
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
    console.error("Error playing kitchen alarm:", error);
  }
}

function orderIdLabel(order) {
  return String(order?._id || "").slice(-8).toUpperCase();
}

/**
 * Site-wide new-order alarm + modal for signed-in kitchen admins.
 * Lives in the root layout so leaving /kitchen does not drop the SSE stream.
 */
export default function KitchenOrderAlertHost() {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = Boolean(user?.email && isKitchenAdminEmail(user.email));

  const [alertQueue, setAlertQueue] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(getKitchenAudioEnabled);
  const audioContextRef = useRef(null);
  const alarmIntervalRef = useRef(null);
  const eventSourceRef = useRef(null);
  const seenOrderIdsRef = useRef(new Set());
  const audioEnabledRef = useRef(audioEnabled);
  audioEnabledRef.current = audioEnabled;

  const currentAlert = alertQueue[0] || null;

  const stopAlarmLoop = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  }, []);

  const initializeAudio = useCallback(async () => {
    if (audioContextRef.current) {
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume().catch(() => {});
      }
      return audioContextRef.current;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      const context = new AudioContext();
      if (context.state === "suspended") {
        await context.resume();
      }
      audioContextRef.current = context;
      return context;
    } catch (error) {
      console.error("Failed to initialize kitchen alert audio:", error);
      return null;
    }
  }, []);

  const startAlarmLoop = useCallback(async () => {
    if (!audioEnabledRef.current) return;
    stopAlarmLoop();
    const context = await initializeAudio();
    if (!context || !audioEnabledRef.current) return;
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return;
      }
    }
    playAlarmSound(context);
    alarmIntervalRef.current = setInterval(() => {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === "running" && audioEnabledRef.current) {
        playAlarmSound(ctx);
      }
    }, 1200);
  }, [initializeAudio, stopAlarmLoop]);

  const enqueueOrder = useCallback(
    (order) => {
      const id = String(order?._id || "");
      if (!id || seenOrderIdsRef.current.has(id)) return;
      seenOrderIdsRef.current.add(id);
      setAlertQueue((prev) => [...prev, order]);
      startAlarmLoop();
    },
    [startAlarmLoop],
  );

  const dismissCurrentAlert = useCallback(() => {
    setAlertQueue((prev) => {
      const next = prev.slice(1);
      if (next.length === 0) stopAlarmLoop();
      return next;
    });
  }, [stopAlarmLoop]);

  useEffect(() => {
    const syncAudioPreference = () => {
      const enabled = getKitchenAudioEnabled();
      setAudioEnabled(enabled);
      if (!enabled) stopAlarmLoop();
    };
    window.addEventListener(KITCHEN_AUDIO_CHANGED_EVENT, syncAudioPreference);
    window.addEventListener("storage", syncAudioPreference);
    return () => {
      window.removeEventListener(KITCHEN_AUDIO_CHANGED_EVENT, syncAudioPreference);
      window.removeEventListener("storage", syncAudioPreference);
    };
  }, [stopAlarmLoop]);

  useEffect(() => {
    if (!isAdmin || !audioEnabled) return;
    const handleUserInteraction = () => {
      initializeAudio();
    };
    document.addEventListener("click", handleUserInteraction, { once: true });
    document.addEventListener("touchstart", handleUserInteraction, { once: true });
    document.addEventListener("keydown", handleUserInteraction, { once: true });
    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
    };
  }, [isAdmin, audioEnabled, initializeAudio]);

  useEffect(() => {
    if (currentAlert && audioEnabled) {
      startAlarmLoop();
    } else if (!audioEnabled) {
      stopAlarmLoop();
    }
  }, [currentAlert, audioEnabled, startAlarmLoop, stopAlarmLoop]);

  useEffect(() => {
    if (authLoading || !isAdmin) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
    const base = API_BASE_URL
      ? `${API_BASE_URL}/api/orders/kitchen/stream`
      : "/api/orders/kitchen/stream";
    let stopped = false;
    let reconnectTimer = null;

    const connect = () => {
      if (stopped) return;
      clearTimeout(reconnectTimer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      const token =
        typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
      if (!token) return;
      const streamUrl = `${base}?token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("order:created", (event) => {
        try {
          const newOrder = JSON.parse(event.data);
          enqueueOrder(newOrder);
        } catch (error) {
          console.error("Failed to parse kitchen order:created event:", error);
        }
      });

      eventSource.onerror = () => {
        eventSource.close();
        if (eventSourceRef.current === eventSource) {
          eventSourceRef.current = null;
        }
        if (stopped) return;
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    const handleKitchenOrderCreated = (event) => {
      if (event?.detail) enqueueOrder(event.detail);
    };
    window.addEventListener("kitchen-order-created", handleKitchenOrderCreated);

    const handleVisibility = () => {
      if (document.visibilityState !== "visible" || stopped) return;
      const readyState = eventSourceRef.current?.readyState;
      if (readyState !== EventSource.OPEN) {
        connect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      window.removeEventListener("kitchen-order-created", handleKitchenOrderCreated);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [authLoading, isAdmin, enqueueOrder]);

  useEffect(() => {
    return () => {
      stopAlarmLoop();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [stopAlarmLoop]);

  if (!isAdmin || !currentAlert) return null;

  const onKitchenDashboard = pathname === "/kitchen";

  return (
    <AnimatePresence>
      <motion.div
        key={String(currentAlert._id)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
        onClick={(e) => e.target === e.currentTarget && dismissCurrentAlert()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-4 ring-[var(--lime-green)]"
        >
          <div className="bg-[var(--lime-green)] px-6 py-4 text-center">
            <h2 className="text-xl font-bold text-white">New order</h2>
            <p className="mt-0.5 text-sm text-white/90">
              Order #{orderIdLabel(currentAlert)}
            </p>
            {alertQueue.length > 1 && (
              <p className="mt-1 text-xs font-semibold text-white">
                {alertQueue.length - 1} more waiting
              </p>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-6">
            <div className="mb-4">
              <p className="font-semibold text-[var(--coffee-brown)]">
                {currentAlert.customer?.name}
              </p>
              <p className="text-sm text-gray-600">{currentAlert.customer?.phone}</p>
              {currentAlert.customer?.email && (
                <p className="text-sm text-gray-600">{currentAlert.customer.email}</p>
              )}
            </div>
            <div className="mb-4">
              <h4 className="mb-2 font-semibold text-[var(--coffee-brown)]">Items</h4>
              <ul className="space-y-1.5 text-sm">
                {(currentAlert.items || []).map((item, idx) => (
                  <li key={idx}>
                    <span className="font-medium">
                      {item.quantity}x {item.name}
                      {item.loyaltyRewardApplied ? (
                        <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                          Rewarded
                        </span>
                      ) : null}
                    </span>
                    {(item.modifiers || []).length > 0 && (
                      <span className="ml-1 text-gray-600">
                        —{" "}
                        {(item.modifiers || [])
                          .map((m) =>
                            (m.selectedOptions || []).map((o) => o.name).join(", "),
                          )
                          .join("; ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {currentAlert.notes && (
              <div className="mb-4 rounded-lg bg-amber-50 p-2">
                <p className="text-xs font-semibold text-amber-800">Note</p>
                <p className="text-sm text-amber-900">{currentAlert.notes}</p>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-3">
              <span className="font-semibold text-[var(--coffee-brown)]">Total</span>
              <span className="text-lg font-bold text-[var(--coffee-brown)]">
                ${currentAlert.totals?.total?.toFixed(2) ?? "0.00"}
              </span>
            </div>
          </div>
          <div className="space-y-2 p-6 pt-0">
            <button
              type="button"
              onClick={dismissCurrentAlert}
              className="w-full rounded-xl bg-[var(--coffee-brown)] px-6 py-4 text-lg font-bold text-white transition-all hover:bg-[var(--coffee-brown-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)] focus:ring-offset-2"
            >
              Got it — stop alarm
            </button>
            {!onKitchenDashboard && (
              <button
                type="button"
                onClick={() => {
                  dismissCurrentAlert();
                  router.push("/kitchen");
                }}
                className="w-full rounded-xl border-2 border-[var(--coffee-brown)] px-6 py-3 text-base font-semibold text-[var(--coffee-brown)] transition-all hover:bg-[var(--coffee-brown)]/5"
              >
                Open Kitchen Dashboard
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
