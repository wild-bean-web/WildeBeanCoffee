/**
 * Retail whole-bean offerings available for purchase in store.
 * Keep copy launch-ready (present tense) — no "coming soon" / "launching" language.
 */
export const RETAIL_YIRGACHEFFE = {
  id: "ethiopian-yirgacheffe-retail",
  name: "Ethiopian Yirgacheffe",
  tagline: "Fresh Roasted Whole Beans · Single Origin",
  fullTitle:
    "Ethiopian Yirgacheffe Whole Coffee Beans — Single Origin Arabica, Fresh Roasted Premium Coffee",
  description:
    "Specialty Arabica from high-altitude farms in southern Ethiopia. Bright and fragrant with floral jasmine, citrus and bergamot acidity, and fruit notes of blueberry and peach. Sold as freshly roasted whole beans — grind at home for the freshest cup.",
  shortDescription:
    "Freshly roasted whole beans — bright single-origin Arabica with floral jasmine, citrus, bergamot, and soft fruit notes.",
  origin: "Yirgacheffe, Ethiopia",
  roastLevel: "Medium",
  bagSize: "12 oz",
  form: "Whole bean",
  price: 17.53,
  currency: "USD",
  inStoreOnly: true,
  image: "/images/products/single-origin/ethiopia-yirgacheffe.jpeg",
  flavorNotes: ["Jasmine", "Bergamot", "Citrus", "Blueberry", "Peach"],
  highlights: [
    { label: "Form", value: "Whole bean" },
    { label: "Size", value: "12 oz" },
    { label: "Roast", value: "Medium" },
    { label: "Price", value: "$17.53" },
  ],
};

export const RETAIL_BEANS = [RETAIL_YIRGACHEFFE];

export function formatRetailPrice(price, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Overlay launch-ready retail fields onto API products that match known SKUs.
 * Ensures shop UI stays correct even if the DB hasn't been re-seeded yet.
 */
export function applyRetailBeanOverrides(products = []) {
  return products.map((product) => {
    const name = (product.name || "").toLowerCase();
    if (!name.includes("yirgacheffe")) return product;

    return {
      ...product,
      name: RETAIL_YIRGACHEFFE.name,
      description: RETAIL_YIRGACHEFFE.description,
      origin: RETAIL_YIRGACHEFFE.origin,
      roastLevel: RETAIL_YIRGACHEFFE.roastLevel,
      flavorNotes: RETAIL_YIRGACHEFFE.flavorNotes,
      price: RETAIL_YIRGACHEFFE.price,
      currency: RETAIL_YIRGACHEFFE.currency,
      priceUnknown: false,
      comingSoon: false,
      inStock: true,
      inStoreOnly: true,
      bagSize: RETAIL_YIRGACHEFFE.bagSize,
      imageComingSoon: false,
      images: [RETAIL_YIRGACHEFFE.image],
    };
  });
}
