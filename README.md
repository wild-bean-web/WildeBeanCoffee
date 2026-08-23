# WildeCoffeeBean

## Digital menu (in-store TVs)

Full-screen menu pages for café displays—no USB sticks required. Update the SVGs in the repo, deploy, and refresh the browser on each TV.

| URL path | Source file |
|----------|-------------|
| `/digitalmenu/coffee` | `client/public/images/DigitalMenusSVG/Revised Coffee Menu.svg` |
| `/digitalmenu/smoothies` | `client/public/images/DigitalMenusSVG/Revised Smoothie Menu.svg` |

**Production examples**

- `https://wildbeancoffeeshop.com/digitalmenu/coffee`
- `https://wildbeancoffeeshop.com/digitalmenu/smoothies`

**Behavior**

- Site chrome (nav, footer, cookie banner) is hidden on these routes.
- The SVG scales with `object-fit: contain` on a black background so the full menu stays visible on different aspect ratios.
- Use the on-page **Fullscreen** control so the browser hides its own UI (tabs and the outer window are controlled by the OS/browser, not the website). For a dedicated display, consider launching the browser in **kiosk mode** (e.g. Chrome `--kiosk <url>`).

**Implementation**

- `client/src/app/digitalmenu/[menu]/page.js` — static routes `coffee` and `smoothies`
- `client/src/app/digitalmenu/[menu]/DigitalMenuClient.js` — viewport layout + fullscreen helper
- `client/src/components/AppChrome.js` — omits global chrome when the path starts with `/digitalmenu`

---

## Kitchen menu availability (86 tool)

Kitchen admins can mark menu items out of stock when an ingredient runs out or when a specific item should be 86'd.

| URL | Who |
|-----|-----|
| `/kitchen/availability` | Kitchen admins (same accounts as Kitchen Dashboard) |

**Search**

- By **menu item name** (e.g. Green Glow) — toggle that item directly
- By **recipe ingredient** (e.g. Spinach) — see all dependent items and bulk-toggle them

**Behavior**

- Sets `available: false` on menu items (customers cannot order them online)
- Recipe profiles live in `server/data/recipeIngredientsByMenuItem.js` (built-in ingredients only, not optional add-ons)
- After updating recipe data, sync to a database: `node server/scripts/syncRecipeIngredients.js` (see script for flags)

**Implementation**

- `client/src/app/kitchen/availability/page.js` — admin UI
- `server/routes/menuAdmin.js` — kitchen-admin API (`/api/menu/admin/*`)
- `server/services/menuAvailabilityService.js` — search, dependents, availability toggles

---

## App version

Semver is stored in `version.json` at the repo root. The version appears in the site footer and on `GET /health`.

**Before each production release**, bump from the repo root:

```bash
npm run release:patch   # typical release (0.1.0 → 0.1.1)
npm run release:minor
npm run release:major
```

Then commit, tag, and push (see `docs/deployment-checklist.md`).

---

## Scripts

### Release (version bump)

```bash
npm run release:patch
```

### Sync recipe ingredients to database

```bash
node server/scripts/syncRecipeIngredients.js
```

### Parse inventory xlsx to JSON

```bash
node scripts/parse-inventory-xlsx.js
```
