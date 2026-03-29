import mongoose from "mongoose";

const LoyaltyStampCreditSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    /** Increments when member redeems a reward (new earning cycle). */
    cycle: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["active", "revoked_cancel"],
      default: "active",
    },
  },
  { timestamps: true }
);

LoyaltyStampCreditSchema.index({ userId: 1, cycle: 1, status: 1 });

const LoyaltyStampCredit =
  mongoose.models.LoyaltyStampCredit ||
  mongoose.model("LoyaltyStampCredit", LoyaltyStampCreditSchema);

export default LoyaltyStampCredit;
