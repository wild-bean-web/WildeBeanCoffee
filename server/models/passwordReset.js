import mongoose from "mongoose";

const PasswordResetSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired documents
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for email lookups
PasswordResetSchema.index({ email: 1, verified: 1 });

const PasswordReset =
  mongoose.models.PasswordReset ||
  mongoose.model("PasswordReset", PasswordResetSchema);

export default PasswordReset;

