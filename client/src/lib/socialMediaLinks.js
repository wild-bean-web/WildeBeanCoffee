/**
 * Centralized social media links configuration
 * Update these URLs in one place to change them across the entire application
 */

export const SOCIAL_MEDIA_LINKS = {
  instagram: "https://www.instagram.com/wildbeancoffeellc/",
  facebook: "https://www.facebook.com/profile.php?id=61585535062575",
  tiktok: "https://www.tiktok.com/@wild.bean.coffee5",
};

/** Handles that open the profile inside the native apps more reliably than bare web URLs. */
export const SOCIAL_PROFILE = {
  instagram: {
    username: "wildbeancoffeellc",
    /** `_u` path is the reliable in-app profile deep link for Instagram. */
    web: "https://www.instagram.com/_u/wildbeancoffeellc/",
    app: "instagram://user?username=wildbeancoffeellc",
  },
  tiktok: {
    username: "wild.bean.coffee5",
    web: "https://www.tiktok.com/@wild.bean.coffee5",
    app: "tiktok://user?username=wild.bean.coffee5",
  },
};

/** Short hosted QR destinations (deploy required). */
export const SOCIAL_QR_DESTINATIONS = {
  instagram: "https://wildbeancoffeeshop.com/go/instagram",
  tiktok: "https://wildbeancoffeeshop.com/go/tiktok",
};
