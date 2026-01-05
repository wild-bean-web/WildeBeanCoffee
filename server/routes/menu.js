import express from "express";
import mongoose from "mongoose";
import { MenuItem, ModifierGroup } from "../models/index.js";
import { errorResponse, validateQueryBoolean } from "../utils/validation.js";

const router = express.Router();

// GET /api/menu
// Filters: section, tags (comma-separated), available, active, search
router.get("/", async (req, res, next) => {
  try {
    const { section, tags, search } = req.query;
    const available = validateQueryBoolean(req.query.available);
    const active = validateQueryBoolean(req.query.active);
    const query = {};

    query.active = active === undefined ? true : active;
    if (available !== undefined) {
      query.available = available;
    }

    if (section) {
      query.section = section;
    }

    if (tags) {
      query.tags = { $in: tags.split(",").map((t) => t.trim()) };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const items = await MenuItem.find(query)
      .populate("modifierGroups", "name description type required minSelections maxSelections options available")
      .sort({ section: 1, name: 1 })
      .lean();
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// GET /api/menu/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "Invalid menu item id");
    }
    const item = await MenuItem.findById(id)
      .populate("modifierGroups", "name description type required minSelections maxSelections options available")
      .lean();
    if (!item) {
      return errorResponse(res, 404, "Menu item not found");
    }
    res.json({ data: item });
  } catch (err) {
    next(err);
  }
});

// GET /api/menu/modifier-groups
// Get all available modifier groups
router.get("/modifier-groups", async (req, res, next) => {
  try {
    const groups = await ModifierGroup.find({ available: true })
      .sort({ name: 1 })
      .lean();
    res.json({ data: groups });
  } catch (err) {
    next(err);
  }
});

export default router;

