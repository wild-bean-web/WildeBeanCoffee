/** Mirror server Bean Stamps rules for UI (server enforces). */

const _beanPub = process.env.NEXT_PUBLIC_BEAN_STAMPS_ENABLED;
/** false|0 → off. true|1 → on. Unset: on in `next dev` only; production builds need NEXT_PUBLIC_BEAN_STAMPS_ENABLED=true. */
export const BEAN_STAMPS_ENABLED =
  _beanPub === "false" || _beanPub === "0"
    ? false
    : _beanPub === "true" || _beanPub === "1"
      ? true
      : process.env.NODE_ENV === "development";

export const LOYALTY_STAMPS_PER_REWARD = 20;
export const LOYALTY_QUALIFY_MIN_TOTAL = 10;
export const LOYALTY_FREE_ITEM_MAX_PRE_TAX = 15;

/**
 * Short customer-facing description of the redemption benefit (no cart jargon).
 * Program detail: discount applies to one selected cart entry, pre-tax, capped at LOYALTY_FREE_ITEM_MAX_PRE_TAX; quantity on that entry counts toward that entry’s total.
 */
export function getLoyaltyRewardTagline() {
  return `Up to $${LOYALTY_FREE_ITEM_MAX_PRE_TAX} off your pick`;
}

/** Same words as getLoyaltyRewardTagline with lowercase “up” for mid-sentence use. */
export function getLoyaltyRewardTaglineMidSentence() {
  return `up to $${LOYALTY_FREE_ITEM_MAX_PRE_TAX} off your pick`;
}

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
