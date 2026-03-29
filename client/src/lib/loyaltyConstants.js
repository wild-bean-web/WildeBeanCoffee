/** Mirror server Bean Stamps rules for UI (server enforces). */

/** Off until launch. Set NEXT_PUBLIC_BEAN_STAMPS_ENABLED=true (must match server BEAN_STAMPS_ENABLED). */
export const BEAN_STAMPS_ENABLED =
  process.env.NEXT_PUBLIC_BEAN_STAMPS_ENABLED === "true" ||
  process.env.NEXT_PUBLIC_BEAN_STAMPS_ENABLED === "1";

export const LOYALTY_STAMPS_PER_REWARD = 20;
export const LOYALTY_QUALIFY_MIN_TOTAL = 10;
export const LOYALTY_FREE_ITEM_MAX_PRE_TAX = 15;

export const STAMP_IMAGE_BASE = "/images/RewardIcons/Stamps";

/** 1-based stamp index for progress display (1..20). */
export function getStampImageSrc(stampNumberOneBased) {
  const n = Math.min(
    LOYALTY_STAMPS_PER_REWARD,
    Math.max(1, Math.floor(stampNumberOneBased) || 1),
  );
  return `${STAMP_IMAGE_BASE}/stamp${n}.png`;
}

export const REWARD_ASSETS = {
  applyReward: "/images/RewardIcons/ApplyReward/Apply-reward.png",
  emptyState: "/images/RewardIcons/EmptyState/empty-state.png",
  confetti: "/animations/Confetti.json",
  /**
   * Optional: PNG for empty stamp slots, e.g. "/images/RewardIcons/Stamps/placeholder-beans.png".
   * Leave empty to use the built-in bean SVG (no extra file).
   */
  stampSlotPlaceholder: "",
};
