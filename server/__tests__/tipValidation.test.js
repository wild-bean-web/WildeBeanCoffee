import {
  foodSubtotalCentsFromItems,
  maxTipCentsForFoodSubtotal,
  validateTipCents,
  validateTipForItems,
} from "../services/tipValidation.js";

describe("tipValidation", () => {
  describe("maxTipCentsForFoodSubtotal", () => {
    it("uses cent rounding so 50% of $8.45 allows $4.23 (production incident)", () => {
      expect(maxTipCentsForFoodSubtotal(845)).toBe(423);
      expect(validateTipCents(423, 845)).toEqual({
        ok: true,
        tipCents: 423,
        tipDollars: 4.23,
      });
    });

    it("rejects tip one cent over the 50% cap", () => {
      expect(validateTipCents(424, 845)).toEqual({
        ok: false,
        error: "tip exceeds maximum for this order",
      });
    });
  });

  describe("validateTipForItems", () => {
    const jazzyItems = [
      {
        price: 8.45,
        quantity: 1,
      },
    ];

    it("accepts 50% tip on $8.45 shaken espresso order", () => {
      const food = foodSubtotalCentsFromItems(jazzyItems);
      expect(food).toBe(845);
      expect(validateTipForItems(4.23, jazzyItems)).toEqual({
        ok: true,
        tipCents: 423,
        tipDollars: 4.23,
      });
    });

    it("rejects invalid tip amounts", () => {
      expect(validateTipForItems(-1, jazzyItems)).toEqual({
        ok: false,
        error: "tip must be a non-negative number",
      });
      expect(validateTipForItems(4.24, jazzyItems)).toEqual({
        ok: false,
        error: "tip exceeds maximum for this order",
      });
    });
  });
});
