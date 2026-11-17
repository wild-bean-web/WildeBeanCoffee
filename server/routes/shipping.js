import express from "express";
import { isBeanShippingEnabled } from "../config/featureFlags.js";
import {
  BAG_PRICE_USD,
  FREE_SHIPPING_AT_BAGS,
  MAX_SHIP_BAGS,
  shippingCentsForBags,
} from "../config/shipping.js";
import {
  addressFromPlace,
  autocompleteAddress,
  placesConfigured,
} from "../services/addressAutocomplete.js";
import { errorResponse } from "../utils/validation.js";

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({
    data: {
      enabled: isBeanShippingEnabled(),
      bagPrice: BAG_PRICE_USD,
      maxBags: MAX_SHIP_BAGS,
      freeShippingAt: FREE_SHIPPING_AT_BAGS,
      shippingByBags: Object.fromEntries(
        Array.from({ length: MAX_SHIP_BAGS }, (_, index) => {
          const bags = index + 1;
          return [bags, shippingCentsForBags(bags) / 100];
        }),
      ),
      placesConfigured: placesConfigured(),
    },
  });
});

router.post("/autocomplete", async (req, res, next) => {
  try {
    if (!isBeanShippingEnabled()) {
      return errorResponse(res, 404, "Bean shipping is not available");
    }
    const suggestions = await autocompleteAddress(req.body?.input);
    res.json({ data: { suggestions } });
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.message);
    next(err);
  }
});

router.post("/place", async (req, res, next) => {
  try {
    if (!isBeanShippingEnabled()) {
      return errorResponse(res, 404, "Bean shipping is not available");
    }
    const address = await addressFromPlace(req.body?.placeId);
    res.json({ data: address });
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.message);
    next(err);
  }
});

export default router;
