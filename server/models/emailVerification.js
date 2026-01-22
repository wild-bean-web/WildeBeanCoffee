import mongoose from "mongoose";

const EmailVerificationSchema = new mongoose.Schema(
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
EmailVerificationSchema.index({ email: 1, verified: 1 });

const EmailVerification =
  mongoose.models.EmailVerification ||
  mongoose.model("EmailVerification", EmailVerificationSchema);

export default EmailVerification;

