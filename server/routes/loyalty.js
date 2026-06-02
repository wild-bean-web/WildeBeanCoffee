import express from "express";
import { authenticate } from "../middleware/auth.js";
import { requireKitchenAdmin } from "../middleware/kitchenAdmin.js";
import { errorResponse } from "../utils/validation.js";
import { getLoyaltySnapshotForUserId } from "../services/loyalty.js";
import { isBeanStampsEnabled } from "../config/featureFlags.js";
import { User } from "../models/index.js";
import LoyaltyStampCredit from "../models/loyaltyStampCredit.js";
import { LOYALTY_STAMPS_PER_REWARD } from "../config/loyaltyConstants.js";

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

/**
 * GET /api/loyalty/admin/users-stamps
 * Kitchen admins: all registered users with active stamp count in their current cycle (from DB).
 */
router.get(
  "/admin/users-stamps",
  authenticate,
  requireKitchenAdmin,
  async (req, res, next) => {
    try {
      if (!isBeanStampsEnabled()) {
        return errorResponse(res, 404, "Bean Stamps is not available.");
      }
      const stampColl = LoyaltyStampCredit.collection.name;
      const rows = await User.aggregate([
        {
          $project: {
            email: 1,
            firstName: 1,
            lastName: 1,
            loyaltyCycle: { $ifNull: ["$loyaltyCycle", 0] },
            createdAt: 1,
          },
        },
        {
          $lookup: {
            from: stampColl,
            let: { uid: "$_id", cycle: "$loyaltyCycle" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$userId", "$$uid"] },
                      { $eq: ["$cycle", "$$cycle"] },
                      { $eq: ["$status", "active"] },
                    ],
                  },
                },
              },
            ],
            as: "_stamps",
          },
        },
        {
          $project: {
            email: 1,
            firstName: 1,
            lastName: 1,
            loyaltyCycle: 1,
            createdAt: 1,
            activeStampsThisCycle: { $size: "$_stamps" },
          },
        },
        { $sort: { email: 1 } },
      ]);

      const data = rows.map((r) => ({
        userId: r._id,
        email: r.email,
        name: `${r.firstName || ""} ${r.lastName || ""}`.trim(),
        loyaltyCycle: r.loyaltyCycle,
        activeStampsThisCycle: r.activeStampsThisCycle,
        rewardReady: r.activeStampsThisCycle >= LOYALTY_STAMPS_PER_REWARD,
        stampsPerReward: LOYALTY_STAMPS_PER_REWARD,
      }));

      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
