/**
 * Documents the catering traveler Included Supplies default used by CustomizationModal.
 * Keep in sync with the "Included Supplies" branch in CustomizationModal defaults.
 */
const INCLUDED_SUPPLIES_DEFAULT =
  "Sugar, Sweeteners, Stirrers & Napkins";
const INCLUDED_SUPPLIES_OPT_OUT = "No supplies";

describe("catering Included Supplies defaults", () => {
  it("defaults to the include option and offers an opt-out", () => {
    const options = [
      { name: INCLUDED_SUPPLIES_DEFAULT, available: true },
      { name: INCLUDED_SUPPLIES_OPT_OUT, available: true },
    ];
    const defaultOption = options.find(
      (opt) => opt.name === INCLUDED_SUPPLIES_DEFAULT && opt.available,
    );
    expect(defaultOption?.name).toBe(INCLUDED_SUPPLIES_DEFAULT);
    expect(options.map((o) => o.name)).toEqual([
      INCLUDED_SUPPLIES_DEFAULT,
      INCLUDED_SUPPLIES_OPT_OUT,
    ]);
  });
});
