"use client";

import Image from "next/image";
import { useState } from "react";
import { REWARD_ASSETS } from "@/lib/loyaltyConstants";

/** Twin-bean mark for unearned stamp slots (SVG fallback if optional PNG fails). */
function BeanPairSvg({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <title>Unearned stamp</title>
      {/* Left bean */}
      <ellipse
        cx="26"
        cy="36"
        rx="14"
        ry="20"
        transform="rotate(-28 26 36)"
        className="fill-[var(--coffee-brown)]/25 stroke-[var(--coffee-brown)]/45"
        strokeWidth="1.5"
      />
      {/* Right bean */}
      <ellipse
        cx="46"
        cy="36"
        rx="14"
        ry="20"
        transform="rotate(28 46 36)"
        className="fill-[var(--coffee-brown)]/25 stroke-[var(--coffee-brown)]/45"
        strokeWidth="1.5"
      />
      {/* Center groove hint */}
      <path
        d="M34 22c-2 8-2 20 0 28"
        className="stroke-[var(--coffee-brown)]/30"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Placeholder for a stamp not yet earned. Uses placeholder-beans.png if present; otherwise SVG.
 */
export default function BeanStampSlotPlaceholder({ className = "" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = (REWARD_ASSETS.stampSlotPlaceholder || "").trim();

  if (!src || imgFailed) {
    return (
      <BeanPairSvg className={`h-14 w-14 max-h-[85%] max-w-[85%] ${className}`} />
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={56}
      height={56}
      className={`h-auto w-[70%] max-h-[85%] object-contain opacity-50 ${className}`}
      unoptimized
      onError={() => setImgFailed(true)}
    />
  );
}
