const PACK_SUFFIX =
  /\s*[-–]\s*[\d,]+\s*(?:\/\s*)?(?:case|pack|ct|count|cs)\.?\s*$/i;
const PACK_INLINE = /\b[\d,]+\s*\/\s*(?:case|pack|ct|count|cs)\b/gi;
const SIZE =
  /(\d+(?:\.\d+)?\s*(?:fl\.?\s*oz|fluid\s*ounces?|oz\.?|ounces?|gal(?:lon)?s?|lbs?|pounds?|ct|count|in\.?))\b/i;
const LEADING_BRAND =
  /^(?:choice|sysco|us\s*foods?|restaurant\s+(?:the\s+)?store|the\s+restaurant\s+store)\s+/i;
const DROP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "choice",
  "pet",
  "customizable",
  "customised",
  "customized",
  "clear",
  "our",
]);

const LOWER_UNITS = new Set(["oz", "oz.", "fl", "lb", "lbs", "ct", "in", "ml", "l"]);

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (/^\d/.test(word) || LOWER_UNITS.has(lower)) return lower;
      if (index > 0 && LOWER_UNITS.has(lower.replace(/\.$/, ""))) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function normalizeVendorDescription(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function canonicalVendorName(name: string | null | undefined): string {
  const collapsed = (name ?? "").replace(/\s+/g, " ").trim();
  if (!collapsed) return "Unknown vendor";
  if (/restaurant/i.test(collapsed) && /store/i.test(collapsed)) {
    return "The Restaurant Store";
  }
  return collapsed;
}

export function extractVendorSku(
  description: string | null | undefined,
  productCode?: string | null,
): string | null {
  const code = productCode?.trim();
  if (code && /^[A-Z0-9][A-Z0-9-]{3,}$/i.test(code)) {
    return code.toUpperCase();
  }
  const match = description?.trim().match(/^([A-Z0-9][A-Z0-9-]{3,})\s+(.+)$/i);
  return match?.[1]?.toUpperCase() ?? null;
}

export function vendorDescriptionWithoutSku(
  description: string | null | undefined,
  productCode?: string | null,
): string {
  const trimmed = description?.trim() ?? "";
  if (!trimmed) return productCode?.trim() || "Untitled item";
  const sku = extractVendorSku(trimmed, productCode);
  if (!sku) return trimmed;
  const stripped = trimmed.replace(new RegExp(`^${sku}\\s+`, "i"), "").trim();
  return stripped || trimmed;
}

/**
 * Turns a vendor invoice description into a short count-sheet name.
 * Example: Choice Clear PET Customizable Plastic Cold Cup - 16 oz. - 1,000/Case
 * becomes "16 oz Plastic Cold Cup".
 */
export function suggestCountSheetName(vendorDescription: string): string {
  let text = vendorDescription.normalize("NFKC").trim();
  if (!text) return "Untitled item";

  text = text.replace(PACK_SUFFIX, "").replace(PACK_INLINE, " ");
  text = text.replace(LEADING_BRAND, "");
  text = text.replace(/\s*[-–:|]+\s*/g, " ").replace(/\s+/g, " ").trim();

  const size = text.match(SIZE)?.[1]?.replace(/\s+/g, " ").replace(/\.$/, "");
  const withoutSize = size ? text.replace(SIZE, " ") : text;
  const words = withoutSize
    .split(/[^A-Za-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !DROP_WORDS.has(word.toLowerCase()));

  const core = words.slice(-4).join(" ");
  const combined = [size, core].filter(Boolean).join(" ").trim();
  return titleCase(combined || text);
}

export function inferProductCategory(text: string): string {
  const haystack = text.toLowerCase();
  if (
    /frozen|freezer|smoothie/.test(haystack)
  ) {
    return "Frozen fruit";
  }
  if (
    /milk|dairy|cream|oat|almond|juice|produce|yogurt/.test(haystack)
  ) {
    return "Dairy";
  }
  if (
    /coffee|bean|espresso|matcha|tea|syrup|powder|cocoa/.test(haystack)
  ) {
    return "Espresso beans";
  }
  if (/cup|lid|straw|napkin|packag|sleeve|carrier/.test(haystack)) {
    return "Cupware";
  }
  return "Dry storage";
}
