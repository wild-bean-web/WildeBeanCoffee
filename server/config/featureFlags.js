/**
 * Feature toggles (env). Bean Stamps defaults off until launch.
 * Enable with BEAN_STAMPS_ENABLED=true on the server and NEXT_PUBLIC_BEAN_STAMPS_ENABLED=true on the client.
 */
export function isBeanStampsEnabled() {
  const v = process.env.BEAN_STAMPS_ENABLED;
  return v === "true" || v === "1";
}
