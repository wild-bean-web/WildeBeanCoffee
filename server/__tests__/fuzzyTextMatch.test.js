import {
  fuzzyTextMatchesQuery,
  levenshtein,
} from "../utils/fuzzyTextMatch.js";

describe("fuzzyTextMatch", () => {
  it("matches exact and case-insensitive text", () => {
    expect(fuzzyTextMatchesQuery("Green Glow", "green glow")).toBe(true);
    expect(fuzzyTextMatchesQuery("Spinach", "SPINACH")).toBe(true);
  });

  it("matches partial prefixes", () => {
    expect(fuzzyTextMatchesQuery("Green Glow", "gre")).toBe(true);
    expect(fuzzyTextMatchesQuery("Strawberry Puree", "straw")).toBe(true);
  });

  it("matches common typos", () => {
    expect(fuzzyTextMatchesQuery("Green Glow", "greem glo")).toBe(true);
    expect(fuzzyTextMatchesQuery("Spinach", "spnach")).toBe(true);
    expect(fuzzyTextMatchesQuery("Strawberry Puree", "strawbery pure")).toBe(
      true,
    );
  });

  it("matches compact typing without spaces", () => {
    expect(fuzzyTextMatchesQuery("Green Glow", "greenglow")).toBe(true);
  });

  it("does not match unrelated queries", () => {
    expect(fuzzyTextMatchesQuery("Green Glow", "iced latte")).toBe(false);
    expect(fuzzyTextMatchesQuery("Spinach", "xyz")).toBe(false);
  });

  it("computes levenshtein distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("spinach", "spnach")).toBe(1);
  });
});
