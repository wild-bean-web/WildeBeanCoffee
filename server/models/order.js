import mongoose from "mongoose";

// Schema for selected modifier options
const SelectedModifierSchema = new mongoose.Schema(
  {
    modifierGroupName: { type: String, required: true, trim: true }, // e.g., "Cup Size"
    selectedOptions: [
      {
        name: { type: String, required: true, trim: true }, // e.g., "Large"
        price: { type: Number, default: 0, min: 0 }, // Additional cost per unit for this option
        quantity: { type: Number, default: 1, min: 1 }, // e.g. 5 for "5 pumps"
      },
    ],
  },
  { _id: false }
);

const OrderItemSchema = new mongoose.Schema(
  {
    itemType: { type: String, enum: ["product", "menu"], required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true }, // snapshot of name at purchase
    price: { type: Number, required: true, min: 0 }, // snapshot of base price at purchase
    quantity: { type: Number, required: true, min: 1, default: 1 },
    modifiers: [SelectedModifierSchema], // Selected customization options
    modifierTotal: { type: Number, default: 0, min: 0 }, // Total additional cost from modifiers
    notes: { type: String, trim: true },
    /** Client cart line id for Bean Stamps redeem matching (optional). */
    cartKey: { type: String, trim: true },
  },
  { _id: false }
);

const TotalsSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    }, // Link to user if authenticated
    isGuest: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    }, // true if order placed by guest (not signed in), false if placed by authenticated user
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true },
    },
    items: { type: [OrderItemSchema], required: true, validate: (v) => v.length > 0 },
    status: {
      type: String,
      enum: ["placed", "preparing", "ready", "completed", "cancelled"],
      default: "placed",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "authorized", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentRef: { type: String, trim: true }, // external payment ID
    pickupTime: { type: Date },
    notes: { type: String, trim: true },
    totals: { type: TotalsSchema, required: true },
    /** Bean Stamps: one free line applied on this order. */
    loyaltyRedeemApplied: { type: Boolean, default: false },
    loyaltyDiscountSubtotal: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

OrderSchema.index({ status: 1, paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, createdAt: -1 }); // Index for user orders queries

const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);
export default Order;

