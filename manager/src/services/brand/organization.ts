import "server-only";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { organizations } from "@/db/schema";
import { getDocumentStore } from "@/services/storage/document-store";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const storedBrandSchema = z.object({
  primaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  logoKey: z.string().min(8).max(400).optional(),
});

export interface OrganizationBrand {
  displayName: string;
  primaryColor: string;
  accentColor: string;
  hasLogo: boolean;
}

const DEFAULT_PRIMARY = "#24160e";
const DEFAULT_ACCENT = "#619b32";

export function parseBrandColors(input: {
  primaryColor: string;
  accentColor: string;
}): { primaryColor: string; accentColor: string } | null {
  const parsed = z
    .object({ primaryColor: hexColor, accentColor: hexColor })
    .safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function imageKind(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function readStoredBrand(settings: unknown) {
  if (!settings || typeof settings !== "object" || !("brand" in settings)) return {};
  const parsed = storedBrandSchema.safeParse(settings.brand);
  return parsed.success ? parsed.data : {};
}

export async function getOrganizationBrand(
  organizationId: string | null,
): Promise<OrganizationBrand> {
  const empty: OrganizationBrand = {
    displayName: "Manager",
    primaryColor: DEFAULT_PRIMARY,
    accentColor: DEFAULT_ACCENT,
    hasLogo: false,
  };
  if (!organizationId) return empty;
  const [row] = await getDb()
    .select({
      displayName: organizations.displayName,
      settings: organizations.settings,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!row) return empty;
  const brand = readStoredBrand(row.settings);
  return {
    displayName: row.displayName,
    primaryColor: brand.primaryColor ?? DEFAULT_PRIMARY,
    accentColor: brand.accentColor ?? DEFAULT_ACCENT,
    hasLogo: Boolean(brand.logoKey),
  };
}

export async function saveOrganizationBrand(input: {
  organizationId: string;
  primaryColor: string;
  accentColor: string;
  logo?: { filename: string; bytes: Uint8Array } | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const colors = parseBrandColors(input);
  if (!colors) {
    return { ok: false, message: "Choose a sidebar color and an accent color." };
  }

  const db = getDb();
  const [row] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);
  if (!row) return { ok: false, message: "This company could not be found." };

  const current =
    row.settings && typeof row.settings === "object" ? { ...row.settings } : {};
  const existing = readStoredBrand(current);
  const nextBrand: { primaryColor: string; accentColor: string; logoKey?: string } = {
    primaryColor: colors.primaryColor,
    accentColor: colors.accentColor,
  };
  if (existing.logoKey) nextBrand.logoKey = existing.logoKey;

  if (input.logo) {
    const kind = imageKind(input.logo.bytes);
    if (!kind) {
      return { ok: false, message: "The logo needs to be a PNG, JPEG, or WebP image." };
    }
    if (input.logo.bytes.byteLength > 2_000_000) {
      return { ok: false, message: "The logo needs to be under 2 MB." };
    }
    const stored = await getDocumentStore().storeOriginal({
      organizationId: input.organizationId,
      documentId: randomUUID(),
      originalFilename: input.logo.filename,
      mimeType: kind,
      bytes: input.logo.bytes,
    });
    nextBrand.logoKey = stored.objectKey;
  }

  await db
    .update(organizations)
    .set({
      settings: { ...current, brand: nextBrand },
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, input.organizationId));

  return { ok: true };
}

export async function readOrganizationLogo(
  organizationId: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const [row] = await getDb()
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const brand = readStoredBrand(row?.settings);
  if (!brand.logoKey) return null;
  const bytes = await getDocumentStore().readOriginal(brand.logoKey);
  const contentType = brand.logoKey.endsWith(".png")
    ? "image/png"
    : brand.logoKey.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  return { bytes, contentType };
}
