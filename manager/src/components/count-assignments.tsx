"use client";

import { CloudOff, LoaderCircle, RefreshCcw, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  cacheCountAssignments,
  getCountDeviceId,
  listCachedCountAssignments,
  listOfflineCountObservations,
  markObservationSyncStatus,
  nextObservationSequence,
  purgeSyncedCountObservations,
  saveOfflineCountObservation,
  type OfflineCountObservation,
} from "@/lib/offline/count-store";
import { StatusPill } from "./status-pill";

interface Assignment {
  id: string;
  sessionId: string;
  name: string;
  status: string;
  lines: {
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    uomId: string;
    unitName: string;
    unitSymbol: string;
    lineNumber: number;
  }[];
}

export function CountAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine,
  );

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/counts/assignments");
      const result = (await response.json()) as {
        data?: { assignments: Assignment[] };
      };
      if (!response.ok || !result.data) {
        throw new Error("Count assignments are unavailable.");
      }
      const received = result.data?.assignments ?? [];
      setAssignments(received);
      await cacheCountAssignments(received);
    } catch {
      const cached = await listCachedCountAssignments().catch(() => []);
      setAssignments(cached);
      if (cached.length > 0) {
        setMessage("Using the assigned count sheet cached on this device.");
      }
    } finally {
      setLoading(false);
      const stored = await listOfflineCountObservations().catch(() => []);
      setPending(
        stored.filter((observation) => observation.syncStatus !== "synced")
          .length,
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    async function load() {
      try {
        const response = await fetch("/api/counts/assignments");
        const result = (await response.json()) as {
          data?: { assignments: Assignment[] };
        };
        if (!response.ok || !result.data) {
          throw new Error("Count assignments are unavailable.");
        }
        const received = result.data.assignments ?? [];
        if (cancelled) return;
        setAssignments(received);
        await cacheCountAssignments(received);
      } catch {
        const cached = await listCachedCountAssignments().catch(() => []);
        if (cancelled) return;
        setAssignments(cached);
        if (cached.length > 0) {
          setMessage("Using the assigned count sheet cached on this device.");
        }
      } finally {
        const stored = await listOfflineCountObservations().catch(() => []);
        if (cancelled) return;
        setLoading(false);
        setPending(
          stored.filter((observation) => observation.syncStatus !== "synced")
            .length,
        );
      }
    }

    void load();
    return () => {
      cancelled = true;
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  async function syncObservations(observations: OfflineCountObservation[]) {
    if (!navigator.onLine || observations.length === 0) return false;
    const response = await fetch("/api/counts/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observations }),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as {
      data: {
        results: {
          clientObservationId: string;
          status: string;
        }[];
      };
    };
    for (const item of result.data.results) {
      await markObservationSyncStatus(
        item.clientObservationId,
        item.status === "conflict" ? "conflict" : "synced",
      );
    }
    await purgeSyncedCountObservations();
    return true;
  }

  async function retryPending() {
    setMessage("Syncing saved observations…");
    const stored = await listOfflineCountObservations();
    const unsynced = stored.filter(
      (observation) => observation.syncStatus === "pending",
    );
    const synced = await syncObservations(unsynced);
    setMessage(
      synced
        ? "Saved observations synced."
        : "Observations remain safely stored on this device.",
    );
    await refresh();
  }

  async function submitCount(
    event: FormEvent<HTMLFormElement>,
    assignment: Assignment,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const deviceId = getCountDeviceId();
    let sequence = await nextObservationSequence(deviceId);
    const observations: OfflineCountObservation[] = assignment.lines.map(
      (line) => ({
        clientObservationId: crypto.randomUUID(),
        deviceId,
        sequenceNumber: sequence++,
        countSessionId: assignment.sessionId,
        countSectionId: assignment.id,
        countLineId: line.id,
        countedQuantity: String(form.get(`quantity-${line.id}`) ?? ""),
        uomId: line.uomId,
        observedAt: new Date().toISOString(),
        syncStatus: "pending",
      }),
    );

    for (const observation of observations) {
      await saveOfflineCountObservation(observation);
    }
    const synced = await syncObservations(observations);
    setMessage(
      synced
        ? `${assignment.name} observations synced.`
        : `${assignment.name} saved securely on this device for later sync.`,
    );
    await refresh();
  }

  if (loading) {
    return (
      <section className="panel">
        <div className="panel-body flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="animate-spin" size={17} />
          Loading assigned count sections…
        </div>
      </section>
    );
  }

  return (
    <section className="panel mb-5">
      <div className="panel-header">
        <div>
          <h2>My count assignments</h2>
          <p>Expected quantities and costs are intentionally hidden.</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={online ? "success" : "warning"}>
            {online ? "Online" : "Offline"}
          </StatusPill>
          {pending > 0 ? (
            <button type="button" className="button" onClick={retryPending}>
              <RefreshCcw size={15} />
              Sync {pending}
            </button>
          ) : null}
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="panel-body">
          <div className="callout">
            <CloudOff size={18} />
            <span>
              No count section is assigned yet. Catalog invoice lines with AKA
              names, then start a count. Every cataloged store item is included,
              and new items are added to any open sheet.
            </span>
          </div>
        </div>
      ) : (
        <div className="content-grid p-4">
          {assignments.map((assignment) => (
            <form
              key={assignment.id}
              className="rounded-2xl border border-border p-4"
              onSubmit={(event) => submitCount(event, assignment)}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-semibold">{assignment.name}</h3>
                <StatusPill tone="info">{assignment.status}</StatusPill>
              </div>
              <div className="form-grid">
                {assignment.lines.map((line) => (
                  <div className="field" key={line.id}>
                    <label htmlFor={`quantity-${line.id}`}>
                      {line.productName}
                      <span className="mt-0.5 block text-xs font-normal text-muted">
                        Count-sheet AKA
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`quantity-${line.id}`}
                        name={`quantity-${line.id}`}
                        className="input"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.001"
                        required
                      />
                      <span className="min-w-14 text-xs text-muted">
                        {line.unitSymbol}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="button button-primary mt-4" type="submit">
                <Save size={16} />
                Save section
              </button>
            </form>
          ))}
        </div>
      )}

      {message ? (
        <div className="border-t border-border px-4 py-3 text-xs text-muted">
          {message}
        </div>
      ) : null}
    </section>
  );
}
