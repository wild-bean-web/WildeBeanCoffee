# Catering Coffee Traveler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add orderable HOT Drip Coffee Traveler (Serves 10) under a new Catering category on `/menu` at $29.99 with Catering Milk (1–2) and Included Supplies modifiers, synced upsert-only to staging/prod.

**Architecture:** Extend seed catalogs for two modifier groups + one menu item; add an idempotent sync script that upserts only those records; insert `"Catering"` into `/menu` section order and show a Customize CTA for the traveler. Cart, checkout, and kitchen already persist/print modifier snapshots—no schema changes.

**Tech Stack:** Node/Express, MongoDB/Mongoose, Next.js (App Router), existing `CustomizationModal`, Jest.

**Spec:** `docs/superpowers/specs/2026-11-02-catering-coffee-traveler-design.md`

## Global Constraints

- Item name exactly: `HOT Drip Coffee Traveler (Serves 10)`
- Section exactly: `Catering`
- Price exactly: `29.99`
- Description verbatim from the spec (96 oz traveler copy)
- `allergens: ["Dairy"]` (Contains: Dairy)
- Image: `/images/menu/Coffee/RegularCoffee.png`
- `onlineOrderable: true` (default; do not set false)
- Modifier groups: `Catering Milk` (multiple, required, min 1, max 2) and `Included Supplies` (single, required); all option prices `0`
- No cups-quantity option
- Do not change any existing item, category, price, or Build Your Own Bowl flow
- Sync upserts only the two groups + one item; no full re-seed
- Catering section order: after Wild Bowl, before Bakery & Pastries
- Integration branch base: `dev` (not `develop`)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `server/seedModifierGroups.js` | Source of truth for Catering Milk + Included Supplies |
| `server/seedMenuItemsFromCSV.js` | Source of truth for traveler menu item |
| `server/__tests__/cateringTravelerSeed.test.js` | Unit tests asserting seed shapes (new) |
| `server/scripts/syncCateringTraveler.js` | Idempotent upsert into test/prod Mongo (new) |
| `client/src/lib/menuCustomizeLabel.js` | Which items show Customize vs Add to Cart (new) |
| `client/src/__tests__/lib/menuCustomizeLabel.test.js` | Unit tests for Customize label helper (new) |
| `client/src/app/menu/page.js` | Section order + wire Customize helper |

No changes expected to: `CustomizationModal.js`, cart/order models, kitchen pages (existing modifier path).

---

### Task 1: Seed Catering modifier groups + traveler item

**Files:**
- Modify: `server/seedModifierGroups.js` (append before closing `];`)
- Modify: `server/seedMenuItemsFromCSV.js` (insert Catering block after Signature Bowl / before Bakery & Pastries)
- Create: `server/__tests__/cateringTravelerSeed.test.js`

**Interfaces:**
- Consumes: existing `modifierGroups` export; `menuItemsFromCSV` export
- Produces: groups named `Catering Milk` and `Included Supplies`; item named `HOT Drip Coffee Traveler (Serves 10)` with `modifierGroupNames: ["Catering Milk", "Included Supplies"]`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/cateringTravelerSeed.test.js`:

```js
import { modifierGroups } from "../seedModifierGroups.js";
import { menuItemsFromCSV } from "../seedMenuItemsFromCSV.js";

describe("Catering coffee traveler seed", () => {
  const milk = () => modifierGroups.find((g) => g.name === "Catering Milk");
  const supplies = () =>
    modifierGroups.find((g) => g.name === "Included Supplies");
  const traveler = () =>
    menuItemsFromCSV.find(
      (i) => i.name === "HOT Drip Coffee Traveler (Serves 10)",
    );

  it("defines Catering Milk as required multiple 1–2 with $0 options", () => {
    expect(milk()).toMatchObject({
      type: "multiple",
      required: true,
      minSelections: 1,
      maxSelections: 2,
    });
    expect(milk().options.map((o) => o.name)).toEqual([
      "2% Milk",
      "Whole Milk",
      "Half and Half",
      "Skim Milk",
      "No Milk",
    ]);
    expect(milk().options.every((o) => o.price === 0 && o.available)).toBe(
      true,
    );
  });

  it("defines Included Supplies as required single with one $0 option", () => {
    expect(supplies()).toMatchObject({
      type: "single",
      required: true,
      minSelections: 1,
      maxSelections: 1,
    });
    expect(supplies().options).toEqual([
      {
        name: "Sugar, Sweeteners, Stirrers & Napkins",
        price: 0,
        available: true,
      },
    ]);
  });

  it("defines the traveler item in Catering at $29.99 with Dairy and linked groups", () => {
    expect(traveler()).toMatchObject({
      section: "Catering",
      price: 29.99,
      currency: "USD",
      allergens: ["Dairy"],
      image: "/images/menu/Coffee/RegularCoffee.png",
      available: true,
      active: true,
      modifierGroupNames: ["Catering Milk", "Included Supplies"],
    });
    expect(traveler().onlineOrderable).not.toBe(false);
    expect(traveler().description).toBe(
      "96 oz drip coffee traveler (serves 10). Each traveler includes 10 cups with lids, sugar and sweetener packets, stirrers, napkins, and milk — pick 1–2 milk options below. Ordering more than one traveler? Each one comes with its own set of cups and supplies.",
    );
  });

  it("does not rename or remove Build Your Own Bowl groups", () => {
    expect(modifierGroups.some((g) => g.name === "Base")).toBe(true);
    expect(
      menuItemsFromCSV.find((i) => i.name === "Build Your Own Bowl")
        ?.modifierGroupNames,
    ).toEqual([
      "Base",
      "Bowl Size",
      "Toppings (Build Your Own)",
      "Drizzels",
      "Fruit Toppings (Build Your Own)",
      "Extra Add-Ons",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- __tests__/cateringTravelerSeed.test.js`

Expected: FAIL — `Catering Milk` / traveler undefined.

- [ ] **Step 3: Add modifier groups to seed**

Append to `server/seedModifierGroups.js` before the final `];`:

```js
  {
    name: "Catering Milk",
    description: "Select 1 to 2 milk options (required)",
    type: "multiple",
    required: true,
    minSelections: 1,
    maxSelections: 2,
    options: [
      { name: "2% Milk", price: 0, available: true },
      { name: "Whole Milk", price: 0, available: true },
      { name: "Half and Half", price: 0, available: true },
      { name: "Skim Milk", price: 0, available: true },
      { name: "No Milk", price: 0, available: true },
    ],
  },
  {
    name: "Included Supplies",
    description: "Included with each traveler (required)",
    type: "single",
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      {
        name: "Sugar, Sweeteners, Stirrers & Napkins",
        price: 0,
        available: true,
      },
    ],
  },
```

- [ ] **Step 4: Add traveler menu item to seed**

In `server/seedMenuItemsFromCSV.js`, insert **after** the Signature Bowl object and **before** `// Bakery & Pastries`:

```js
  // Catering
  {
    name: "HOT Drip Coffee Traveler (Serves 10)",
    description:
      "96 oz drip coffee traveler (serves 10). Each traveler includes 10 cups with lids, sugar and sweetener packets, stirrers, napkins, and milk — pick 1–2 milk options below. Ordering more than one traveler? Each one comes with its own set of cups and supplies.",
    price: 29.99,
    currency: "USD",
    section: "Catering",
    tags: ["catering", "coffee", "traveler", "pickup"],
    allergens: ["Dairy"],
    image: "/images/menu/Coffee/RegularCoffee.png",
    available: true,
    active: true,
    modifierGroupNames: ["Catering Milk", "Included Supplies"],
  },
```

Do not set `onlineOrderable: false` (schema default is `true`).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npm test -- __tests__/cateringTravelerSeed.test.js`

Expected: PASS (all four tests).

- [ ] **Step 6: Commit**

```bash
git add server/seedModifierGroups.js server/seedMenuItemsFromCSV.js server/__tests__/cateringTravelerSeed.test.js
git commit -m "$(cat <<'EOF'
Add Catering traveler seed data and modifier groups.

EOF
)"
```

---

### Task 2: Idempotent sync script (upsert only)

**Files:**
- Create: `server/scripts/syncCateringTraveler.js`
- Modify: `server/__tests__/cateringTravelerSeed.test.js` (add export-name checks the sync will rely on)

**Interfaces:**
- Consumes: `modifierGroups` from `../seedModifierGroups.js`; traveler row from `menuItemsFromCSV`; `ModifierGroup`, `MenuItem`; `getDatabaseNameFromUri`, `PROD_DATABASE_NAME` from `../config/mongoUri.js`
- Produces: CLI that upserts only `Catering Milk`, `Included Supplies`, and `HOT Drip Coffee Traveler (Serves 10)`

- [ ] **Step 1: Extend seed test with sync target names**

Add to `server/__tests__/cateringTravelerSeed.test.js`:

```js
  it("exposes exactly the sync target names for catering", () => {
    const cateringGroups = modifierGroups.filter((g) =>
      ["Catering Milk", "Included Supplies"].includes(g.name),
    );
    expect(cateringGroups).toHaveLength(2);
    expect(
      menuItemsFromCSV.filter((i) => i.section === "Catering"),
    ).toHaveLength(1);
  });
```

- [ ] **Step 2: Run test to verify it passes** (data already from Task 1)

Run: `cd server && npm test -- __tests__/cateringTravelerSeed.test.js`

Expected: PASS.

- [ ] **Step 3: Create `server/scripts/syncCateringTraveler.js`**

```js
/**
 * Upsert Catering Coffee Traveler catalog rows only (no full re-seed).
 *
 * Local TEST:
 *   node scripts/syncCateringTraveler.js
 * Production:
 *   ALLOW_PROD_DB=true node scripts/syncCateringTraveler.js --prod
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ModifierGroup, MenuItem } from "../models/index.js";
import { modifierGroups } from "../seedModifierGroups.js";
import { menuItemsFromCSV } from "../seedMenuItemsFromCSV.js";
import {
  getDatabaseNameFromUri,
  PROD_DATABASE_NAME,
} from "../config/mongoUri.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.argv.includes("--prod");

dotenv.config({ path: join(__dirname, "..", ".env") });
if (!isProd) {
  dotenv.config({ path: join(__dirname, "..", ".env.test"), override: true });
}

const mongoUri = isProd
  ? process.env.MONGODB_URI
  : process.env.MONGODB_TEST_URI || process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error(isProd ? "Missing MONGODB_URI" : "Missing MONGODB_TEST_URI");
}

const dbName = getDatabaseNameFromUri(mongoUri);
if (dbName === PROD_DATABASE_NAME && process.env.ALLOW_PROD_DB !== "true") {
  throw new Error(
    `Refusing to update production. Set ALLOW_PROD_DB=true and pass --prod.`,
  );
}

const GROUP_NAMES = ["Catering Milk", "Included Supplies"];
const ITEM_NAME = "HOT Drip Coffee Traveler (Serves 10)";

async function upsertGroup(name) {
  const seed = modifierGroups.find((g) => g.name === name);
  if (!seed) {
    throw new Error(`[syncCateringTraveler] Seed missing group: ${name}`);
  }
  const { name: _n, ...rest } = seed;
  const group = await ModifierGroup.findOneAndUpdate(
    { name },
    { $set: rest },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  console.log(
    `[syncCateringTraveler] Upserted group ${group.name} (${group.options.length} options)`,
  );
  return group;
}

async function sync() {
  await mongoose.connect(mongoUri);
  console.log(`[syncCateringTraveler] Connected to ${dbName}`);

  const groups = [];
  for (const name of GROUP_NAMES) {
    groups.push(await upsertGroup(name));
  }
  const groupIdByName = Object.fromEntries(groups.map((g) => [g.name, g._id]));

  const seedItem = menuItemsFromCSV.find((i) => i.name === ITEM_NAME);
  if (!seedItem) {
    throw new Error(`[syncCateringTraveler] Seed missing item: ${ITEM_NAME}`);
  }

  const { modifierGroupNames, ...itemFields } = seedItem;
  const modifierGroupIds = modifierGroupNames.map((n) => {
    const id = groupIdByName[n];
    if (!id) throw new Error(`[syncCateringTraveler] Missing group id: ${n}`);
    return id;
  });

  const item = await MenuItem.findOneAndUpdate(
    { name: ITEM_NAME },
    {
      $set: {
        ...itemFields,
        modifierGroups: modifierGroupIds,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  console.log(
    `[syncCateringTraveler] Upserted item ${item.name} @ $${item.price} section=${item.section}`,
  );
  console.log(
    `[syncCateringTraveler] Linked groups: ${modifierGroupNames.join(", ")}`,
  );

  await mongoose.disconnect();
  console.log("[syncCateringTraveler] Done");
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Hard rule:** This script must not loop all menu items, call `clearCatalogData`, or update groups outside `GROUP_NAMES`.

- [ ] **Step 4: Dry-run against test DB (if `MONGODB_TEST_URI` is configured)**

Run: `cd server && node scripts/syncCateringTraveler.js`

Expected stdout includes:
- `Upserted group Catering Milk`
- `Upserted group Included Supplies`
- `Upserted item HOT Drip Coffee Traveler (Serves 10) @ $29.99 section=Catering`
- `Done`

If env is missing, skip DB run but keep the script; unit seed tests already guard payloads. Do **not** pass `--prod` in this task.

- [ ] **Step 5: Commit**

```bash
git add server/scripts/syncCateringTraveler.js server/__tests__/cateringTravelerSeed.test.js
git commit -m "$(cat <<'EOF'
Add upsert-only sync for Catering coffee traveler.

EOF
)"
```

---

### Task 3: Customize label helper + `/menu` section order

**Files:**
- Create: `client/src/lib/menuCustomizeLabel.js`
- Create: `client/src/__tests__/lib/menuCustomizeLabel.test.js`
- Modify: `client/src/app/menu/page.js` (sectionOrder, sectionDisplayOrder, Customize label sites)

**Interfaces:**
- Consumes: menu item `{ name, modifierGroups? }`
- Produces: `usesCustomizeLabel(item) -> boolean`; `getAddToCartLabel(item) -> "Customize" | "Add to Cart"`

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/lib/menuCustomizeLabel.test.js`:

```js
import {
  getAddToCartLabel,
  usesCustomizeLabel,
} from "../../lib/menuCustomizeLabel";

describe("menuCustomizeLabel", () => {
  it("uses Customize for Build Your Own Bowl when it has modifiers", () => {
    const item = {
      name: "Build Your Own Bowl",
      modifierGroups: [{ name: "Base" }],
    };
    expect(usesCustomizeLabel(item)).toBe(true);
    expect(getAddToCartLabel(item)).toBe("Customize");
  });

  it("uses Customize for the Catering traveler when it has modifiers", () => {
    const item = {
      name: "HOT Drip Coffee Traveler (Serves 10)",
      modifierGroups: [{ name: "Catering Milk" }],
    };
    expect(usesCustomizeLabel(item)).toBe(true);
    expect(getAddToCartLabel(item)).toBe("Customize");
  });

  it("keeps Add to Cart for other modifier drinks", () => {
    const item = {
      name: "Latte",
      modifierGroups: [{ name: "Milk Choice" }],
    };
    expect(usesCustomizeLabel(item)).toBe(false);
    expect(getAddToCartLabel(item)).toBe("Add to Cart");
  });

  it("keeps Add to Cart when traveler has no modifier groups yet", () => {
    const item = { name: "HOT Drip Coffee Traveler (Serves 10)" };
    expect(usesCustomizeLabel(item)).toBe(false);
    expect(getAddToCartLabel(item)).toBe("Add to Cart");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/__tests__/lib/menuCustomizeLabel.test.js`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement helper**

Create `client/src/lib/menuCustomizeLabel.js`:

```js
const CUSTOMIZE_LABEL_ITEM_NAMES = new Set([
  "Build Your Own Bowl",
  "HOT Drip Coffee Traveler (Serves 10)",
]);

export function usesCustomizeLabel(item) {
  if (!item?.name) return false;
  const hasModifiers = Array.isArray(item.modifierGroups)
    ? item.modifierGroups.length > 0
    : false;
  return hasModifiers && CUSTOMIZE_LABEL_ITEM_NAMES.has(item.name);
}

export function getAddToCartLabel(item) {
  return usesCustomizeLabel(item) ? "Customize" : "Add to Cart";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/__tests__/lib/menuCustomizeLabel.test.js`

Expected: PASS.

- [ ] **Step 5: Wire helper + Catering section order in `menu/page.js`**

1. Add import near other `@/lib` imports:

```js
import { getAddToCartLabel } from "@/lib/menuCustomizeLabel";
```

2. In `AddToCartControl`, replace the hardcoded BYOB label:

```js
const cardLabel = getAddToCartLabel(item);
```

(Remove the `item.name === "Build Your Own Bowl" && hasModifiers ? "Customize" : "Add to Cart"` ternary.)

3. Insert `"Catering"` into **both** arrays after `"Wild Bowl"`:

```js
const sectionOrder = [
  "Coffee & Espresso",
  "Tea",
  "Smoothies (Organic & Fresh)",
  "Wild Bowl",
  "Catering",
  "Bakery & Pastries",
];

const sectionDisplayOrder = [
  "Coffee & Espresso",
  "Tea",
  "Smoothies (Organic & Fresh)",
  "Wild Bowl",
  "Catering",
  "Bakery & Pastries",
];
```

4. In the detail modal button, replace:

```js
{selectedMenuItem.name === "Build Your Own Bowl" && selectedMenuItem.modifierGroups?.length > 0 ? "Customize" : "Add to Cart"}
```

with:

```js
{getAddToCartLabel(selectedMenuItem)}
```

Do not change pastry in-store-only handling, bowl allergen notes, or CustomizationModal.

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/menuCustomizeLabel.js client/src/__tests__/lib/menuCustomizeLabel.test.js client/src/app/menu/page.js
git commit -m "$(cat <<'EOF'
Show Catering on the menu and Customize for the traveler.

EOF
)"
```

---

### Task 4: Manual verification against the checklist

**Files:** none required (verification only)

**Interfaces:**
- Consumes: deployed/local app + test DB after `node scripts/syncCateringTraveler.js`
- Produces: confirmation notes for each checklist item

- [ ] **Step 1: Ensure test catalog has traveler**

Run: `cd server && node scripts/syncCateringTraveler.js`

Expected: upsert logs for both groups + traveler.

- [ ] **Step 2: Verify `/menu` UI**

With client + API pointed at the synced DB:

1. Catering filter appears after Wild Bowl and before Bakery & Pastries  
2. Catering section shows traveler at **$29.99** and **Contains: Dairy**  
3. Card/detail CTA says **Customize**  
4. Customize modal: milk checkboxes with “Select up to 2 option(s)”; supplies radio  
5. Add to Cart disabled until ≥1 milk + supplies; selecting a 3rd milk does not stick  
6. When valid: button shows **Add to Cart - $29.99** (or equivalent live price with `$29.99`)

- [ ] **Step 3: Verify cart + kitchen**

1. Add traveler with 1–2 milks + supplies; cart line shows selections; total `$29.99 × qty`  
2. Place a test order; kitchen/previous view shows Catering Milk and Included Supplies selections  
3. Spot-check Build Your Own Bowl customize + one coffee item still behave as before  

- [ ] **Step 4: Commit only if verification found code fixes**

If fixes were needed, commit them with a clear message. If verification passed with no code changes, skip commit.

---

## Deploy notes (post-merge; not a code task)

1. Deploy app (section order + Customize label).  
2. Staging: `cd server && node scripts/syncCateringTraveler.js`  
3. Smoke checklist on staging.  
4. Prod: `cd server && ALLOW_PROD_DB=true node scripts/syncCateringTraveler.js --prod`  
5. Confirm Catering on prod; spot-check existing items unchanged.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Catering Milk + Included Supplies seeds | Task 1 |
| Traveler item $29.99, description, Dairy, image, onlineOrderable | Task 1 |
| Upsert-only sync + prod guardrails | Task 2 |
| Section order after Wild Bowl / before Bakery | Task 3 |
| Customize CTA for traveler | Task 3 |
| Modifier UI framework (no one-off) | Task 1 data + existing modal; Task 4 verify |
| Cart/kitchen modifiers | Existing path; Task 4 verify |
| Verification checklist | Task 4 |
| No changes to existing items/bowl | Task 1 regression assert + Task 4 |
