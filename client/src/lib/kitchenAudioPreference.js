export const KITCHEN_AUDIO_STORAGE_KEY = "kitchen-audio-enabled";
export const KITCHEN_AUDIO_CHANGED_EVENT = "kitchen-audio-changed";

export function getKitchenAudioEnabled() {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem(KITCHEN_AUDIO_STORAGE_KEY);
  return saved !== null ? saved === "true" : true;
}

export function setKitchenAudioEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KITCHEN_AUDIO_STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new Event(KITCHEN_AUDIO_CHANGED_EVENT));
}
