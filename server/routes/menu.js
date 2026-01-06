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
    
    // For Coffee & Espresso section, sort hot items before iced/cold items
    if (section === "Coffee & Espresso" || (!section && items.some(item => item.section === "Coffee & Espresso"))) {
      items.sort((a, b) => {
        // Only apply custom sorting to Coffee & Espresso items
        if (a.section === "Coffee & Espresso" && b.section === "Coffee & Espresso") {
          const aIsCold = a.name.toLowerCase().startsWith("iced") || a.name.toLowerCase().startsWith("cold");
          const bIsCold = b.name.toLowerCase().startsWith("iced") || b.name.toLowerCase().startsWith("cold");
          
          // Hot items come first
          if (aIsCold && !bIsCold) return 1;
          if (!aIsCold && bIsCold) return -1;
          
          // If both are same type (both hot or both cold), sort alphabetically
          return a.name.localeCompare(b.name);
        }
        // For items in different sections, maintain original order
        return 0;
      });
    }

    // For Oatmeals section, sort "Custom Oatmeal" to appear last
    if (section === "Oatmeals" || (!section && items.some(item => item.section === "Oatmeals"))) {
      items.sort((a, b) => {
        // Only apply custom sorting to Oatmeals items
        if (a.section === "Oatmeals" && b.section === "Oatmeals") {
          const aIsCustom = a.name.toLowerCase() === "custom oatmeal";
          const bIsCustom = b.name.toLowerCase() === "custom oatmeal";
          
          // Custom Oatmeal comes last
          if (aIsCustom && !bIsCustom) return 1;
          if (!aIsCustom && bIsCustom) return -1;
          
          // If neither or both are custom, sort alphabetically
          return a.name.localeCompare(b.name);
        }
        // For items in different sections, maintain original order
        return 0;
      });
    }
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

