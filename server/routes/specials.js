import express from "express";
import { Special } from "../models/index.js";
import { SPECIAL_CATEGORIES } from "../models/special.js";
import { errorResponse, validateQueryBoolean } from "../utils/validation.js";

const router = express.Router();

const CATEGORY_ORDER = { Coffee: 0, Matcha: 1, Refreshers: 2 };

/**
 * GET /api/specials
 * Query: category, search, active (default true)
 * Returns all matching specials sorted by category, then newest week first, then name.
 */
router.get("/", async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const active = validateQueryBoolean(req.query.active);
    const query = {};

    query.active = active === undefined ? true : active;

    if (category) {
      const normalized = String(category).trim();
      const matched = SPECIAL_CATEGORIES.find(
        (c) => c.toLowerCase() === normalized.toLowerCase(),
      );
      if (!matched) {
        return errorResponse(
          res,
          400,
          `Invalid category. Use one of: ${SPECIAL_CATEGORIES.join(", ")}`,
        );
      }
      query.category = matched;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      const regex = { $regex: term, $options: "i" };
      query.$or = [
        { name: regex },
        { recipe16oz: regex },
        { recipe20oz: regex },
        { notes: regex },
        { weekLabel: regex },
      ];
    }

    const items = await Special.find(query)
      .sort({ weekOf: -1, name: 1 })
      .lean();

    items.sort((a, b) => {
      const catDiff =
        (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99);
      if (catDiff !== 0) return catDiff;
      const weekDiff = new Date(b.weekOf) - new Date(a.weekOf);
      if (weekDiff !== 0) return weekDiff;
      return a.name.localeCompare(b.name);
    });

    return res.json({
      data: items,
      meta: {
        categories: SPECIAL_CATEGORIES,
        count: items.length,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/specials/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const item = await Special.findById(req.params.id).lean();
    if (!item) {
      return errorResponse(res, 404, "Special not found");
    }
    return res.json({ data: item });
  } catch (err) {
    return next(err);
  }
});

export default router;
