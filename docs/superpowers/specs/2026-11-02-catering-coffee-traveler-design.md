# Catering Coffee Traveler (Online Pickup) — Design

**Date:** 2026-11-02  
**Status:** Approved  
**Branch:** `feature/catering-coffee-traveler` (from `dev`)  
**Site:** wildbeancoffeeshop.com `/menu` pickup ordering  

## Goal

Add a new orderable **HOT Drip Coffee Traveler (Serves 10)** under a new **Catering** category on the online pickup menu, mirroring DoorDash modifier setup at the in-store price of **$29.99**, using the existing Build Your Own Bowl–style modifier framework end-to-end.

## Approach

**Data-only mirror of Build Your Own Bowl:** seed the two modifier groups and one menu item, ship an idempotent upsert sync for staging/prod (no full re-seed), and insert `"Catering"` into the hardcoded `/menu` section order. No cart/order schema changes; kitchen already prints modifier snapshots.

---

## §1 — Data (item + modifiers)

### New modifier groups

| Group | `type` | `required` | min / max | Options (all `$0.00`) |
|--------|--------|------------|-----------|------------------------|
| Catering Milk | `multiple` | true | 1–2 | 2% Milk, Whole Milk, Half and Half, Skim Milk, No Milk |
| Included Supplies | `single` | true | 1–1 | Sugar, Sweeteners, Stirrers & Napkins |

Group names are distinct from drink `Milk Choice` groups so the UI does **not** use the milk dropdown path (`MILK_CHOICE_GROUPS`).

### New menu item

- **Name:** `HOT Drip Coffee Traveler (Serves 10)`
- **Section:** `Catering`
- **Price:** `29.99` (fixed; no size variants)
- **`onlineOrderable`:** `true` (not in-store-only like Bakery & Pastries)
- **Description (exact):**  
  `96 oz drip coffee traveler (serves 10). Each traveler includes 10 cups with lids, sugar and sweetener packets, stirrers, napkins, and milk — pick 1–2 milk options below. Ordering more than one traveler? Each one comes with its own set of cups and supplies.`
- **`allergens`:** `["Dairy"]` → existing UI renders **Contains: Dairy**
- **Image:** `/images/menu/Coffee/RegularCoffee.png` (reuse existing asset; no external hotlinks)
- **Modifier groups:** `Catering Milk`, `Included Supplies`
- **No cups-quantity option** — cups fixed at 10 per traveler and covered in the description

### Source of truth

- `server/seedModifierGroups.js` — add both groups  
- `server/seedMenuItemsFromCSV.js` — add the traveler item with `modifierGroupNames`  
- Sync script (below) upserts these into existing DBs  

### Guarantees

- Do **not** change any existing item, category, price, or Build Your Own Bowl groups/flow  
- Sync upserts **only** these two groups + this one item (matched by unique `name`)

---

## §2 — Sync / deploy (upsert only)

### Script

**Path:** `server/scripts/syncCateringTraveler.js`  

**Pattern:** Same guardrails as `syncTiramisuIncludedMilk.js` / `syncModifierGroups.js`:

- Default: test/staging DB via `MONGODB_TEST_URI` (fallback `MONGODB_URI` if unset)  
- Prod: requires `--prod` **and** `ALLOW_PROD_DB=true`; refuses prod DB name otherwise  

### Behavior (only this)

1. Upsert modifier group `Catering Milk` (`findOneAndUpdate` by `name`, `{ upsert: true }`)  
2. Upsert modifier group `Included Supplies` the same way  
3. Upsert menu item `HOT Drip Coffee Traveler (Serves 10)` by `name`, setting section, price, description, image, allergens, `onlineOrderable`, and linking the two group `_id`s  
4. Does **not** run full `seed.js`, delete collections, or `$set` any other menu items or groups  

### Commands

| Env | Command (from `server/`) | Database |
|-----|--------------------------|----------|
| Staging / local test | `node scripts/syncCateringTraveler.js` | `MONGODB_TEST_URI` |
| Production | `ALLOW_PROD_DB=true node scripts/syncCateringTraveler.js --prod` | `MONGODB_URI` |

### Deploy sequence

1. Merge/deploy the app so `/menu` includes Catering in section order and Customize labeling works  
2. Run sync against **staging/test** → smoke `/menu` + a test order  
3. Run sync against **prod** with prod flags  
4. Confirm prod shows Catering + traveler; spot-check an existing item (e.g. Build Your Own Bowl) unchanged  

Frontend without sync → Catering empty until script runs. Sync without frontend → item may appear via API but filter order may be wrong until the section-order change is live.

---

## §3 — UI (`/menu` + Customize)

### Section order and filter

In `client/src/app/menu/page.js`, insert `"Catering"` into both `sectionOrder` and `sectionDisplayOrder` **after** `"Wild Bowl"` and **before** `"Bakery & Pastries"`. Filter chips are derived from those arrays + live sections, so Catering gets its own filter button and section once the traveler exists in the API.

### Card / detail

Same patterns as other orderable items:

- Price `$29.99`  
- Description  
- **Contains: Dairy** via allergens  
- Regular Coffee image  
- **Available** state (not the pastry in-store-only path)  

### Customize CTA

Today only Build Your Own Bowl hardcodes the **Customize** label. Extend that check on card and detail buttons to also include `HOT Drip Coffee Traveler (Serves 10)`. Click still opens existing `CustomizationModal`. Do **not** retitle every modifier drink to Customize.

### Modifier UI (existing framework — no one-off UI)

- **Catering Milk:** checkboxes; required shown as red `*` (same as bowls); helper **“Select up to 2 option(s)”**; third milk blocked by existing `maxSelections` logic  
- **Included Supplies:** radio, select exactly one  
- Add to Cart disabled with standard “Please select…” hint until milk min 1 and supplies selected  
- Live button price: **Add to Cart - $29.99** once required groups are satisfied (all modifiers `$0.00`)  

Item detail stays consistent with other customization popups (description, Available, gated add).

---

## §4 — Cart / kitchen

### Cart and checkout

No schema changes. `CustomizationModal` already snapshots:

```js
{ modifierGroupName, selectedOptions: [{ name, price, quantity }] }
```

onto the cart line; checkout maps that into the order payload the same way as bowls.

For the traveler:

- Line shows name + selected milk option(s) + supplies line  
- Unit price `$29.99`; modifiers `$0.00`  
- Cart quantity = number of travelers; line total = `$29.99 × qty`  
- Different milk/supplies builds stay separate lines via existing `cartKey`

### Order record / staff

Kitchen and previous-order views already print `Group: opt1, opt2` from `order.items[].modifiers`. Staff see e.g. **Catering Milk: 2% Milk, Whole Milk** and **Included Supplies: Sugar, Sweeteners, Stirrers & Napkins** with no new kitchen UI.

---

## Out of scope

- No delivery — site is pickup-only  
- No Clover or DoorDash changes  
- Do not fix unrelated drink detail popups missing size/milk selectors  
- Do not change existing items, categories, prices, or Build Your Own Bowl  

---

## Verification checklist

1. `/menu` shows **Catering** filter + section (after Wild Bowl, before Bakery) with traveler at **$29.99** and **Contains: Dairy**  
2. Customize requires **1–2 milks** + supplies; Add to Cart gated until satisfied; a **3rd milk is blocked**  
3. Cart shows traveler with milk + supplies selections at **$29.99 × quantity**  
4. Test order record (kitchen/staff view) includes milk and supplies selections  
5. Existing menu items and Build Your Own Bowl still work unchanged  
6. Staging then prod: run `syncCateringTraveler.js` (upsert-only); confirm no other catalog rows changed  

---

## Implementation touchpoints (summary)

| Area | Files / action |
|------|----------------|
| Modifier seeds | `server/seedModifierGroups.js` |
| Item seed | `server/seedMenuItemsFromCSV.js` |
| Sync | `server/scripts/syncCateringTraveler.js` (new) |
| Section order / Customize label | `client/src/app/menu/page.js` |
| Cart / kitchen | No code changes expected (existing modifier path) |
