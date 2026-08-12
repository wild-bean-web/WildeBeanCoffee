import mongoose from "mongoose";

const SPECIAL_CATEGORIES = ["Coffee", "Matcha", "Refreshers"];

const BuildLineSchema = new mongoose.Schema(
  {
    item: { type: String, required: true, trim: true },
    oz16: { type: String, trim: true, default: "" },
    oz20: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const SpecialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: SPECIAL_CATEGORIES,
      trim: true,
    },
    /** Shared base ingredients / milk / espresso / matcha. */
    base: [{ type: String, trim: true }],
    /** Size-specific amounts (pumps, oz, drops) — primary barista scan table. */
    build: [BuildLineSchema],
    /** Cold foam, drizzle, garnish, toppings. */
    toppings: [{ type: String, trim: true }],
    /** Short ordered steps when the build isn’t obvious. */
    method: [{ type: String, trim: true }],
    /** Monday (or sheet date) this special ran / starts. */
    weekOf: { type: Date, required: true },
    /** Human label, e.g. "8/12" or "Archive". */
    weekLabel: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: "" },
    /** Flattened text for ingredient search. */
    searchText: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

SpecialSchema.index({ category: 1, weekOf: -1, name: 1 });
SpecialSchema.index({ name: 1, weekOf: 1 }, { unique: true });
SpecialSchema.index({
  name: "text",
  searchText: "text",
  notes: "text",
  weekLabel: "text",
});

const Special =
  mongoose.models.Special || mongoose.model("Special", SpecialSchema);

export { SPECIAL_CATEGORIES };
export default Special;
