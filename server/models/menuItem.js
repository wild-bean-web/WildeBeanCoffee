import mongoose from "mongoose";

const MenuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    section: { type: String, trim: true }, // e.g., Espresso, Tea, Food
    tags: [{ type: String, trim: true }], // Kept for backward compatibility
    allergens: [{ type: String, trim: true }], // Allergy information: Gluten, Lactose, Nuts, Soy, Eggs, etc.
    available: { type: Boolean, default: true },
    /** When false, item is shown on the menu but cannot be ordered online (in-store only). */
    onlineOrderable: { type: Boolean, default: true },
    image: { type: String, trim: true },
    active: { type: Boolean, default: true },
    modifierGroups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ModifierGroup",
      },
    ], // References to modifier groups that can be applied to this item
    cloverId: { type: String, trim: true }, // Clover item ID for integration
  },
  { timestamps: true }
);

MenuItemSchema.index({ active: 1, section: 1, available: 1 });

const MenuItem = mongoose.models.MenuItem || mongoose.model("MenuItem", MenuItemSchema);
export default MenuItem;

