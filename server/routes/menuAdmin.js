import express from "express";
import mongoose from "mongoose";
import { authenticate } from "../middleware/auth.js";
import { requireKitchenAdmin } from "../middleware/kitchenAdmin.js";
import { errorResponse } from "../utils/validation.js";
import {
  listIngredients,
  searchAvailability,
  findIngredientDependents,
  setMenuItemAvailable,
  bulkSetMenuItemsAvailable,
} from "../services/menuAvailabilityService.js";

const router = express.Router();

router.use(authenticate, requireKitchenAdmin);

// GET /api/menu/admin/search?search=Green+Glow
router.get("/search", async (req, res, next) => {
  try {
    const data = await searchAvailability(req.query.search || "");
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/menu/admin/ingredients?search=spinach
router.get("/ingredients", async (req, res, next) => {
  try {
    const ingredients = await listIngredients(req.query.search || "");
    res.json({ data: ingredients });
  } catch (err) {
    next(err);
  }
});

// GET /api/menu/admin/dependents?ingredient=Spinach
router.get("/dependents", async (req, res, next) => {
  try {
    const ingredient = String(req.query.ingredient || "").trim();
    if (!ingredient) {
      return errorResponse(res, 400, "ingredient query parameter is required");
    }
    const data = await findIngredientDependents(ingredient);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/menu/admin/items/:id/available
router.patch("/items/:id/available", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "Invalid menu item id");
    }
    if (typeof req.body?.available !== "boolean") {
      return errorResponse(res, 400, "available boolean is required");
    }
    const item = await setMenuItemAvailable(id, req.body.available);
    if (!item) return errorResponse(res, 404, "Menu item not found");
    res.json({ data: item });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/menu/admin/items/bulk-available
router.patch("/items/bulk-available", async (req, res, next) => {
  try {
    const { itemIds, available } = req.body || {};
    if (!Array.isArray(itemIds) || !itemIds.length) {
      return errorResponse(res, 400, "itemIds array is required");
    }
    if (typeof available !== "boolean") {
      return errorResponse(res, 400, "available boolean is required");
    }
    const invalid = itemIds.some((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalid) return errorResponse(res, 400, "One or more itemIds are invalid");
    const data = await bulkSetMenuItemsAvailable(itemIds, available);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
