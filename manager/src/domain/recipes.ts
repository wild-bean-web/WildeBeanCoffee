export function recipeCodeFromName(name: string): string {
  const code = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return code || "recipe";
}

export function uniqueRecipeCode(name: string, taken: ReadonlySet<string>): string {
  const base = recipeCodeFromName(name);
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base}-${suffix}`.slice(0, 96);
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("A unique recipe code could not be assigned.");
}

/**
 * Ingredient amount to pull before trim. A waste factor of 0.2 means 20%
 * of what is pulled is lost, so 1 usable unit requires 1.25 pulled.
 */
export function quantityToPull(usableQuantity: number, wasteFactor: number): number {
  if (!(usableQuantity > 0) || !Number.isFinite(usableQuantity)) {
    throw new Error("Usable quantity must be greater than zero.");
  }
  if (!(wasteFactor >= 0) || wasteFactor >= 1 || !Number.isFinite(wasteFactor)) {
    throw new Error("Waste factor must be from 0 up to, but not including, 1.");
  }
  return Math.round((usableQuantity / (1 - wasteFactor)) * 1_000_000) / 1_000_000;
}
