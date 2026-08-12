import mongoose from "mongoose";

const SPECIAL_CATEGORIES = ["Coffee", "Matcha", "Refreshers"];

const SpecialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: SPECIAL_CATEGORIES,
      trim: true,
    },
    /** Full build instructions for a 16 oz drink. */
    recipe16oz: { type: String, required: true, trim: true },
    /**
     * 20 oz size notes. Often only the deltas vs 16 oz (extra pumps/oz)
     * as written on the weekly specials sheet.
     */
    recipe20oz: { type: String, trim: true, default: "" },
    /** Monday (or sheet date) this special ran / starts, for sorting & history. */
    weekOf: { type: Date, required: true },
    /** Optional human label from the sheet, e.g. "7/27". */
    weekLabel: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

SpecialSchema.index({ category: 1, weekOf: -1, name: 1 });
SpecialSchema.index({ name: 1, weekOf: 1 }, { unique: true });
SpecialSchema.index({
  name: "text",
  recipe16oz: "text",
  recipe20oz: "text",
  notes: "text",
});

const Special =
  mongoose.models.Special || mongoose.model("Special", SpecialSchema);

export { SPECIAL_CATEGORIES };
export default Special;
