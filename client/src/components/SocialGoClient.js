"use client";

import { useEffect, useState } from "react";
import { SOCIAL_PROFILE } from "@/lib/socialMediaLinks";

/**
 * Opens the native app profile when possible, then falls back to the web profile URL.
 * Used by QR codes so scanners land on our cafe page — not the app home feed.
 */
export default function SocialGoClient({ network }) {
  const profile = SOCIAL_PROFILE[network];
  const [status, setStatus] = useState("Opening…");

  useEffect(() => {
    if (!profile) {
      setStatus("Unknown destination");
      return;
    }

    setStatus(`Opening ${network === "instagram" ? "Instagram" : "TikTok"}…`);

    // Try the native app scheme first (works when the scanner opens a browser).
    const appTimer = window.setTimeout(() => {
      window.location.href = profile.app;
    }, 50);

    // Always fall back to the web/universal profile URL.
    const webTimer = window.setTimeout(() => {
      setStatus("Taking you to our page…");
      window.location.replace(profile.web);
    }, 700);

    return () => {
      window.clearTimeout(appTimer);
      window.clearTimeout(webTimer);
    };
  }, [network, profile]);

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
        <p className="text-[var(--coffee-brown)]">This link is not available.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--coffee-brown-very-light)] px-6 text-center">
      <p className="text-lg font-semibold text-[var(--coffee-brown)]">{status}</p>
      <a
        href={profile.web}
        className="rounded-full bg-[var(--lime-green)] px-6 py-3 text-sm font-bold text-white"
      >
        Continue to our {network === "instagram" ? "Instagram" : "TikTok"} page
      </a>
    </main>
  );
}
