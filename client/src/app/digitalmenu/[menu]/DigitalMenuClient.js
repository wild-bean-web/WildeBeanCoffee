"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FULLSCREEN_HINT_KEY = "wildbean_digitalmenu_fullscreen_hint_dismissed";

export default function DigitalMenuClient({ src, label }) {
  const rootRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHintVisible(!sessionStorage.getItem(FULLSCREEN_HINT_KEY));
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    onFsChange();
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const enterFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen({ navigationUI: "hide" });
      }
    } catch {
      /* older browsers / denied */
    }
    sessionStorage.setItem(FULLSCREEN_HINT_KEY, "1");
    setHintVisible(false);
  }, []);

  const dismissHint = useCallback(() => {
    sessionStorage.setItem(FULLSCREEN_HINT_KEY, "1");
    setHintVisible(false);
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-black"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- large local SVG, object-fit needs img */}
      <img
        src={src}
        alt={label}
        className="h-full w-full flex-1 object-contain object-center select-none"
        draggable={false}
      />

      {hintVisible && !fullscreen && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-4">
          <div className="pointer-events-auto flex max-w-lg flex-col gap-2 rounded-lg border border-white/20 bg-black/85 px-4 py-3 text-center text-sm text-white shadow-lg sm:flex-row sm:items-center sm:text-left">
            <p className="text-white/90">
              Tap <span className="font-semibold text-lime-green">Fullscreen</span>{" "}
              to hide the browser UI on this device (tabs and address bar cannot be removed by the
              page alone).
            </p>
            <div className="flex shrink-0 flex-wrap justify-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={enterFullscreen}
                className="rounded-md bg-lime-green px-4 py-2 font-medium text-black transition hover:brightness-110"
              >
                Fullscreen
              </button>
              <button
                type="button"
                onClick={dismissHint}
                className="rounded-md border border-white/30 px-3 py-2 text-white/90 hover:bg-white/10"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {!hintVisible && !fullscreen && (
        <button
          type="button"
          onClick={enterFullscreen}
          className="pointer-events-auto absolute right-2 bottom-2 rounded-md border border-white/25 bg-black/70 px-3 py-1.5 text-xs text-white/90 opacity-60 hover:opacity-100"
        >
          Fullscreen
        </button>
      )}
    </div>
  );
}
