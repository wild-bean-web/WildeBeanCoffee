# API Endpoints Log

Keep this file updated as endpoints are added. Group by category and list method/path plus brief notes.

## Health
- `GET /health` — Service status, app version (`version`), and DB connection info.

## Catalog (Products)
- `GET /api/products` — List products. Filters: `search`, `category` (comma-separated), `inStock`, `active` (defaults to true).
- `GET /api/products/:id` — Fetch single product by id.

## Menu
- `GET /api/menu` — List menu items. Filters: `section`, `tags` (comma-separated), `available`, `active` (defaults to true), `search`.
- `GET /api/menu/:id` — Fetch single menu item by id.

## Menu Admin (kitchen admins only)
Requires authenticated kitchen-admin session (same users as Kitchen Dashboard).

- `GET /api/menu/admin/search?search=` — Search menu items by name and recipe ingredients. Returns `{ ingredients, menuItems }`.
- `GET /api/menu/admin/ingredients?search=` — List recipe ingredients (optional filter).
- `GET /api/menu/admin/dependents?ingredient=` — Menu items whose recipe includes the ingredient.
- `PATCH /api/menu/admin/items/:id/available` — Body: `{ available: boolean }`. Toggle one item in/out of stock.
- `PATCH /api/menu/admin/items/bulk-available` — Body: `{ itemIds: string[], available: boolean }`. Bulk toggle.

## Orders
- `POST /api/orders` — Create order (validates customer/items, computes totals, defaults status=placed, paymentStatus=pending; accepts optional pickupTime, notes, paymentRef, taxRate).
- `GET /api/orders/:id` — Get order by id.
- `PATCH /api/orders/:id/status` — Update order status/paymentStatus.
- `POST /api/orders/webhook` — Webhook stub (logs payload; add signature verification later).

## Seed & Data
- Run `npm run seed` in `server/` to populate sample products, menu items, and a location.
- Recipe ingredient profiles for menu availability are in `server/data/recipeIngredientsByMenuItem.js`. Sync to a database with `node server/scripts/syncRecipeIngredients.js`.

## Payments
- _TBD_ — Add Clover payment/webhook endpoints when implemented.

## Locations/Maps
- `GET /api/location` — Return address, hours, contact, and coordinates (first active location).
- `POST /api/location/distance` — Body: `{ lat, lng }`, returns distance from user to store coords (km/miles).

