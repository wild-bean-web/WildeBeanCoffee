import mongoose from "mongoose";

const ManagerOutboxEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        "website.order.paid",
        "website.order.refunded",
        "website.order.cancelled",
      ],
      immutable: true,
    },
    aggregateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      immutable: true,
    },
    aggregateVersion: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },
    schemaVersion: {
      type: Number,
      required: true,
      default: 1,
      immutable: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ["pending", "delivering", "delivered", "dead_letter"],
      default: "pending",
      required: true,
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0, required: true },
    nextAttemptAt: { type: Date, default: Date.now, required: true },
    deliveringSince: { type: Date },
    deliveredAt: { type: Date },
    lastErrorCode: { type: String, trim: true },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

ManagerOutboxEventSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
ManagerOutboxEventSchema.index(
  { aggregateId: 1, eventType: 1, aggregateVersion: 1 },
  { unique: true },
);

const ManagerOutboxEvent =
  mongoose.models.ManagerOutboxEvent ||
  mongoose.model("ManagerOutboxEvent", ManagerOutboxEventSchema);

export default ManagerOutboxEvent;
