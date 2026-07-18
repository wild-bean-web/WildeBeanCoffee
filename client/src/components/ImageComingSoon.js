"use client";

/**
 * Professional product-image placeholder until bag photography is ready.
 */
export default function ImageComingSoon({
  label = "Image Coming Soon",
  className = "",
  compact = false,
}) {
  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--coffee-brown-very-light)] via-[#ebe4db] to-[var(--coffee-brown-medium-light)]/40 ${className}`}
      role="img"
      aria-label={label}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(124,179,66,0.18), transparent 45%), radial-gradient(circle at 80% 70%, rgba(61,40,23,0.12), transparent 50%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-12deg, transparent, transparent 12px, rgba(61,40,23,0.35) 12px, rgba(61,40,23,0.35) 13px)",
        }}
        aria-hidden
      />

      <div
        className={`relative z-10 flex flex-col items-center text-center ${compact ? "gap-2 px-4" : "gap-3 px-6"}`}
      >
        <div
          className={`flex items-center justify-center rounded-2xl border border-[var(--coffee-brown)]/15 bg-white/70 shadow-sm backdrop-blur-sm ${compact ? "h-12 w-12" : "h-16 w-16"}`}
        >
          <svg
            className={`text-[var(--coffee-brown)]/55 ${compact ? "h-6 w-6" : "h-8 w-8"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p
          className={`font-semibold tracking-wide text-[var(--coffee-brown)]/75 ${compact ? "text-xs uppercase" : "text-sm uppercase sm:text-base"}`}
        >
          {label}
        </p>
        {!compact && (
          <p className="max-w-[14rem] text-xs text-[var(--coffee-brown)]/50 sm:text-sm">
            Product photography in progress
          </p>
        )}
      </div>
    </div>
  );
}
