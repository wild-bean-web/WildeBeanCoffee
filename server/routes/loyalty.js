import express from "express";
import { authenticate } from "../middleware/auth.js";
import { errorResponse } from "../utils/validation.js";
import { getLoyaltySnapshotForUserId } from "../services/loyalty.js";
import { isBeanStampsEnabled } from "../config/featureFlags.js";

const router = express.Router();

/**
 * Bean Stamps summary for the signed-in user (online-only program).
 */
router.get("/me", authenticate, async (req, res, next) => {
  try {
    if (!isBeanStampsEnabled()) {
      return errorResponse(res, 404, "Bean Stamps is not available.");
    }
    const snapshot = await getLoyaltySnapshotForUserId(req.user._id);
    if (!snapshot) {
      return errorResponse(res, 404, "Loyalty not available");
    }
    res.json({ data: snapshot });
  } catch (err) {
    next(err);
  }
});

export default router;
