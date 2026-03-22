import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true }, // Will be hashed with bcrypt
    phone: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// unique: true on email already creates the index — no schema.index({ email }) to avoid duplicate index warnings

const User = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;

