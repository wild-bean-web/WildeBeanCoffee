import mongoose from "mongoose";

/**
 * Server-side copy of the order payload when starting Clover Hosted Checkout.
 * Used to create the MongoDB order if the browser never completes /order/success (webhook path).
 */
const HostedCheckoutDraftSchema = new mongoose.Schema(
  {
    checkoutSessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    /** Same shape as POST /api/orders body (without paymentStatus/paymentRef). */
    orderDraft: { type: mongoose.Schema.Types.Mixed, required: true },
    /** Signed-in user at checkout time (Bean Stamps); optional for guests. */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    amountCents: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["pending", "fulfilled"],
      default: "pending",
    },
    fulfilledOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    /** Set when order placement fails after payment (webhook or recover); cleared on success. */
    lastPlacementError: { type: String, default: null },
    lastPlacementErrorAt: { type: Date, default: null },
  },
  { timestamps: true }
);

HostedCheckoutDraftSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1209600 }); // 14 days

const HostedCheckoutDraft =
  mongoose.models.HostedCheckoutDraft ||
  mongoose.model("HostedCheckoutDraft", HostedCheckoutDraftSchema);

export default HostedCheckoutDraft;
