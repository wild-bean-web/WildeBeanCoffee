export const ACTIVE_LOCATION_COOKIE = "wb_active_location";

export interface CafeAddress {
  line1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  phone?: string;
}

export interface ManagerLocation {
  id: string;
  code: string;
  name: string;
  timezone: string;
  address: CafeAddress | null;
}

export function pickActiveLocationId(
  allowedIds: readonly string[],
  requestedId: string | null | undefined,
): string | null {
  if (allowedIds.length === 0) return null;
  if (requestedId && allowedIds.includes(requestedId)) return requestedId;
  return allowedIds[0] ?? null;
}

export function locationCodeFromName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "store";
}

export function asCafeAddress(value: unknown): CafeAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const text = (key: keyof CafeAddress) =>
    typeof record[key] === "string" ? record[key] : undefined;
  const address: CafeAddress = {
    line1: text("line1"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postalCode"),
    phone: text("phone"),
  };
  return Object.values(address).some(Boolean) ? address : null;
}

export function formatCafeAddress(
  address: CafeAddress | null | undefined,
): string | null {
  if (!address) return null;
  const locality = [address.city, address.region].filter(Boolean).join(", ");
  const cityLine = [locality, address.postalCode].filter(Boolean).join(" ").trim();
  const parts = [address.line1?.trim(), cityLine, address.phone?.trim()].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}
