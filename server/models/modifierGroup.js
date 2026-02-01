import mongoose from "mongoose";

// Schema for individual modifier options (e.g., "Small", "Medium", "Large" for Cup Size)
const ModifierOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g., "Small", "Whole Milk", "Vanilla"
    price: { type: Number, default: 0, min: 0 }, // Additional cost for this option (in dollars)
    available: { type: Boolean, default: true },
  },
  { _id: true }
);

// Schema for modifier groups (e.g., "Cup Size", "Milk Choice", "Syrup Pumps")
const ModifierGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true }, // e.g., "Cup Size", "Milk Choice"
    description: { type: String, trim: true }, // Optional description
    type: {
      type: String,
      enum: ["single", "multiple"], // single = radio buttons, multiple = checkboxes
      default: "single",
    },
    required: { type: Boolean, default: false }, // Whether a selection is required
    minSelections: { type: Number, default: 0, min: 0 }, // Minimum number of selections (for multiple type)
    maxSelections: { type: Number, default: 1, min: 1 }, // Maximum number of selections
    options: [ModifierOptionSchema], // Available options for this modifier group
    available: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ModifierGroupSchema.index({ name: 1, available: 1 });

const ModifierGroup =
  mongoose.models.ModifierGroup ||
  mongoose.model("ModifierGroup", ModifierGroupSchema);

export default ModifierGroup;


