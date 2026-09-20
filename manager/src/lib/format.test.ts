import { describe, expect, it } from "vitest";
import { parseMoneyToCents } from "./format";

describe("parseMoneyToCents", () => {
  it("reads restaurant-store totals and credits", () => {
    expect(parseMoneyToCents("$1,611.24")).toBe(161_124);
    expect(parseMoneyToCents("$-900.61")).toBe(-90_061);
    expect(parseMoneyToCents("$199.95")).toBe(19_995);
    expect(parseMoneyToCents("128.4 USD")).toBe(12_840);
  });
});
