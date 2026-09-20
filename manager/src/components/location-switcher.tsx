"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { ManagerLocation } from "@/lib/location";

export function LocationSwitcher({
  locations,
  activeLocationId,
  canCreate = false,
}: {
  locations: ManagerLocation[];
  activeLocationId: string | null;
  canCreate?: boolean;
}) {
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const active =
    locations.find((location) => location.id === activeLocationId) ??
    locations[0] ??
    null;
  const canOpen = locations.length > 1 || canCreate;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setAdding(false);
        setError(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setAdding(false);
        setError(null);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (adding) nameRef.current?.focus();
  }, [adding]);

  if (locations.length === 0 && !canCreate) return null;

  async function switchLocation(locationId: string) {
    if (locationId === activeLocationId) {
      setOpen(false);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/session/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!response.ok) {
        throw new Error("The location could not be switched.");
      }
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The location could not be switched.",
      );
    } finally {
      setPending(false);
    }
  }

  async function createLocation() {
    const nextName = name.trim();
    if (!nextName) {
      setError("A store name is required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const payload = (await response.json()) as {
        data?: ManagerLocation;
        error?: { message: string };
      };
      if (!response.ok || !payload.data?.id) {
        throw new Error(
          payload.error?.message ?? "The location could not be created.",
        );
      }
      await fetch("/api/session/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: payload.data.id }),
      });
      setName("");
      setAdding(false);
      setOpen(false);
      router.push("/settings");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The location could not be created.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="location-switcher" ref={rootRef}>
      <span className="location-switcher-label">Location</span>
      {canOpen ? (
        <button
          type="button"
          className="location-switcher-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={menuId}
          disabled={pending}
          onClick={() => {
            setOpen((current) => !current);
            setAdding(false);
            setError(null);
          }}
        >
          <span>{active?.name ?? "Add a location"}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      ) : (
        <p className="location-switcher-current">{active?.name}</p>
      )}
      {open ? (
        <div className="location-switcher-menu" id={menuId} role="listbox">
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              role="option"
              aria-selected={location.id === active?.id}
              className={
                location.id === active?.id
                  ? "location-switcher-option location-switcher-option-active"
                  : "location-switcher-option"
              }
              disabled={pending}
              onClick={() => void switchLocation(location.id)}
            >
              {location.name}
            </button>
          ))}
          {canCreate ? (
            adding ? (
              <form
                className="location-switcher-add-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createLocation();
                }}
              >
                <input
                  ref={nameRef}
                  className="location-switcher-add-input"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Silver Spring"
                  aria-label="New store name"
                  disabled={pending}
                  required
                />
                <button
                  className="location-switcher-add-submit"
                  type="submit"
                  disabled={pending}
                >
                  {pending ? "Adding…" : "Add"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="location-switcher-add"
                disabled={pending}
                onClick={() => {
                  setAdding(true);
                  setError(null);
                }}
              >
                <Plus size={15} aria-hidden="true" />
                Add location
              </button>
            )
          ) : null}
          {error ? <p className="location-switcher-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
