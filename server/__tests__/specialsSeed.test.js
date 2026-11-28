import { specialsSeed } from "../seedSpecialsData.js";

function specialByName(name) {
  return specialsSeed.find((item) => item.name === name);
}

describe("Mint Choco Dream specials", () => {
  it("tops the iced drink with peppermint cold foam, not whipped cream", () => {
    const iced = specialByName("Iced Mint Choco Dream");
    expect(iced).toBeDefined();
    expect(iced.toppings).toContain("Peppermint cold foam");
    expect(iced.toppings).not.toContain("Whipped cream");
    expect(iced.method).toContain("Top with peppermint cold foam");
    expect(iced.method).not.toContain("Top with whipped cream");
  });

  it("keeps whipped cream on the hot drink", () => {
    const hot = specialByName("Mint Choco Dream");
    expect(hot).toBeDefined();
    expect(hot.toppings).toContain("Whipped cream");
    expect(hot.method).toContain("Top with whipped cream");
    expect(hot.toppings).not.toContain("Peppermint cold foam");
  });
});
