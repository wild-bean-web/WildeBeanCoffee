import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    roastLevel: { type: String, trim: true },
    origin: { type: String, trim: true },
    flavorNotes: [{ type: String, trim: true }],
    inStock: { type: Boolean, default: true },
    inventory: { type: Number, default: 0, min: 0 },
    images: [{ type: String, trim: true }],
    categories: [{ type: String, trim: true }],
    active: { type: Boolean, default: true },
    comingSoon: { type: Boolean, default: false },
    /** When true, shop UI shows a placeholder instead of numeric price (price may be 0). */
    priceUnknown: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ProductSchema.index({ active: 1, categories: 1 });

const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);
export default Product;

