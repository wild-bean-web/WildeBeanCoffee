import mongoose from "mongoose";

const HoursSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, trim: true }, // e.g., Monday
    opens: { type: String, trim: true }, // e.g., "07:00"
    closes: { type: String, trim: true }, // e.g., "18:00"
    closed: { type: Boolean, default: false },
  },
  { _id: false }
);

const LocationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address1: { type: String, required: true, trim: true },
    address2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, default: "US", trim: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    mapsUrl: { type: String, trim: true },
    hours: [HoursSchema],
    onlineOrderingPaused: { type: Boolean, default: false },
    onlineOrderingPausedAt: { type: Date, default: null },
    onlineOrderingPausedByEmail: { type: String, trim: true, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

LocationSchema.index({ active: 1, city: 1 });

const Location = mongoose.models.Location || mongoose.model("Location", LocationSchema);
export default Location;

