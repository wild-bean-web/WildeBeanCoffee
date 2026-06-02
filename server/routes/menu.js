import express from "express";
import mongoose from "mongoose";
import { MenuItem, ModifierGroup } from "../models/index.js";
import { errorResponse, validateQueryBoolean } from "../utils/validation.js";
import { isMenuItemHiddenFromCustomer } from "../config/customerMenuExclusions.js";

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

    let items = await MenuItem.find(query)
      .populate("modifierGroups", "name displayName description type required minSelections maxSelections options available")
      .sort({ section: 1, name: 1 })
      .lean();
    items = items.filter((item) => !isMenuItemHiddenFromCustomer(item.name));

    // For Coffee & Espresso section, sort hot items before iced/cold items
    if (section === "Coffee & Espresso" || (!section && items.some(item => item.section === "Coffee & Espresso"))) {
      items.sort((a, b) => {
        // Only apply custom sorting to Coffee & Espresso items
        if (a.section === "Coffee & Espresso" && b.section === "Coffee & Espresso") {
          const coldTags = (tags) =>
            Array.isArray(tags) &&
            (tags.includes("cold") || tags.includes("iced"));
          const aIsCold =
            a.name.toLowerCase().startsWith("iced") ||
            a.name.toLowerCase().startsWith("cold") ||
            coldTags(a.tags);
          const bIsCold =
            b.name.toLowerCase().startsWith("iced") ||
            b.name.toLowerCase().startsWith("cold") ||
            coldTags(b.tags);
          
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

    // For Wild Bowl section, sort Signature Bowl, Wild Vegan, then Build Your Own Bowl last
    if (section === "Wild Bowl" || (!section && items.some(item => item.section === "Wild Bowl"))) {
      items.sort((a, b) => {
        if (a.section === "Wild Bowl" && b.section === "Wild Bowl") {
          const order = ["Signature Bowl", "Wild Vegan", "Build Your Own Bowl"];
          const aIndex = order.indexOf(a.name);
          const bIndex = order.indexOf(b.name);
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
    }

    // For Smoothies section, sort in specific order
    if (section === "Smoothies (Organic & Fresh)" || (!section && items.some(item => item.section === "Smoothies (Organic & Fresh)"))) {
      const smoothieOrder = [
        "Green Glow",
        "Triple B",
        "Tropical Bliss",
        "Guava Cream",
        "Berry Mango Tango",
        "Power Couple",
      ];

      items.sort((a, b) => {
        if (a.section === "Smoothies (Organic & Fresh)" && b.section === "Smoothies (Organic & Fresh)") {
          const aIndex = smoothieOrder.indexOf(a.name);
          const bIndex = smoothieOrder.indexOf(b.name);
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a.name.localeCompare(b.name);
        }
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
      .populate("modifierGroups", "name displayName description type required minSelections maxSelections options available")
      .lean();
    if (!item) {
      return errorResponse(res, 404, "Menu item not found");
    }
    if (isMenuItemHiddenFromCustomer(item.name)) {
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

