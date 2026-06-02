import express from "express";
import { Location } from "../models/index.js";
import { errorResponse, safeParseNumber } from "../utils/validation.js";
import { authenticate } from "../middleware/auth.js";
import { requireKitchenAdmin } from "../middleware/kitchenAdmin.js";

const router = express.Router();

function haversineDistance(origin, destination) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(destination.lat - origin.lat);
  const dLon = toRad(destination.lng - origin.lng);
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(destination.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = R * c;
  const miles = km * 0.621371;
  return { km, miles };
}

// GET /api/location
// Returns the first active location (or all active if you later extend)
router.get("/", async (_req, res, next) => {
  try {
    const location = await Location.findOne({ active: true }).lean();
    if (!location) {
      return errorResponse(res, 404, "No active location found");
    }
    res.json({ data: location });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/location/online-ordering-state
// Kitchen admin only: pause/unpause online ordering with env password.
router.patch(
  "/online-ordering-state",
  authenticate,
  requireKitchenAdmin,
  async (req, res, next) => {
    try {
      const togglePassword = String(
        process.env.ONLINE_ORDERING_TOGGLE_PASSWORD || "",
      ).trim();
      if (!togglePassword) {
        return errorResponse(
          res,
          500,
          "Online ordering toggle password is not configured on the server.",
        );
      }

      const providedPassword = String(req.body?.password || "");
      if (!providedPassword) {
        return errorResponse(res, 400, "password is required", ["password"]);
      }
      if (providedPassword !== togglePassword) {
        return errorResponse(res, 401, "Incorrect password");
      }

      const paused = Boolean(req.body?.paused);
      const update = paused
        ? {
            onlineOrderingPaused: true,
            onlineOrderingPausedAt: new Date(),
            onlineOrderingPausedByEmail: req.user?.email || null,
          }
        : {
            onlineOrderingPaused: false,
            onlineOrderingPausedAt: null,
            onlineOrderingPausedByEmail: null,
          };

      const location = await Location.findOneAndUpdate(
        { active: true },
        { $set: update },
        { new: true },
      ).lean();

      if (!location) {
        return errorResponse(res, 404, "No active location found");
      }

      res.json({
        data: {
          onlineOrderingPaused: Boolean(location.onlineOrderingPaused),
          onlineOrderingPausedAt: location.onlineOrderingPausedAt || null,
          onlineOrderingPausedByEmail: location.onlineOrderingPausedByEmail || null,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/location/distance
// Body: { lat: number, lng: number }
router.post("/distance", async (req, res, next) => {
  try {
    const lat = safeParseNumber(req.body?.lat);
    const lng = safeParseNumber(req.body?.lng);

    if (lat === undefined || lng === undefined) {
      return errorResponse(res, 400, "lat and lng are required numeric values");
    }

    const location = await Location.findOne({ active: true }).lean();
    if (!location?.coordinates?.lat || !location?.coordinates?.lng) {
      return errorResponse(res, 404, "No active location with coordinates found");
    }

    const distance = haversineDistance(
      { lat, lng },
      { lat: location.coordinates.lat, lng: location.coordinates.lng }
    );

    res.json({
      data: {
        store: {
          lat: location.coordinates.lat,
          lng: location.coordinates.lng,
        },
        user: { lat, lng },
        distance,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

