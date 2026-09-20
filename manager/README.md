# Wild Bean Coffee Manager

Private, mobile-first operations software for purchasing, document capture,
receiving, inventory, Clover sales, COGS, expenses, and monthly close.

This package is intentionally isolated from the public storefront:

- Separate deployment and domain
- Separate PostgreSQL database
- Separate authentication and staff permissions
- Separate Clover read-only credentials
- Separate private document storage
- Separate worker capacity and deployment pipeline

The manager package may share the Git repository with `client/` and `server/`,
but no manager request calls or imports the storefront runtime.

## Current implementation

- Invite-only authentication boundary with role capabilities
- Mobile receipt capture interface
- Private original-document storage abstraction
- File signature, type, and size validation
- Staged document state and matching domain
- PostgreSQL/Drizzle operational schema
- PostgreSQL-backed job worker
- Inventory UOM, weighted-average, count, and COGS domain rules
- Read-only Clover client, normalization, webhook verification, and controls
- Source-file checksum manifest
- Preview-only parsers for supplied inventory and historical purchase CSVs
- Manager dashboards for purchases, documents, inventory, sales, and close

External integrations remain disabled until dedicated credentials are added.
No storefront credentials should ever be copied into this package.

## Local setup

Requirements:

- Node.js 22.12 or newer
- npm
- PostgreSQL 13 or newer, or Docker

```bash
cp .env.example .env.local
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
MANAGER_DEMO_MODE=true npm run dev -- -p 3001
```

Open `http://localhost:3001`.

`MANAGER_DEMO_MODE` is for local interface work only. Environment validation
rejects it in production.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Data protection

- Raw receipts and invoices are never committed to Git.
- `.manager-data/` contains ignored local manifests and import previews.
- Originals are hashed before transformation and retained separately from
  extracted values.
- AI/OCR output creates a draft only. Posting requires deterministic validation
  and the applicable approval policy.
- Posted ledger records are reversed or superseded, never overwritten.
- Bank transactions prove settlement but do not invent missing item detail.
- Money is stored in integer cents; measured quantities use fixed precision.

## Source preservation

Create a checksum manifest without copying or changing originals:

```bash
npm run source:manifest -- "C:/path/to/inventory.csv" "C:/path/to/invoices"
```

Preview the legacy inventory mapping:

```bash
npm run inventory:preview -- "C:/path/to/inventory.csv" \
  ".manager-data/inventory-preview.json"
```

Preview historical one-time purchases:

```bash
npm run historical-purchases:preview -- \
  "C:/path/to/one-time-purchases.csv" \
  ".manager-data/historical-purchases-preview.json"
```

Preview commands never post financial or inventory records.

## Integration policy

- Clover webhooks provide speed; rolling API reconciliation proves
  completeness.
- Website order details arrive through a sanitized durable outbox.
- Restaurant Store and Odeko start with email/portal exports.
- Wegmans starts with phone receipt capture.
- DoorDash and Uber Eats use approved reporting APIs when available, with
  versioned CSV adapters as fallback.
- Company-card CSV imports are matched to captured purchases before a direct
  bank feed is considered.

## Accounting boundary

The app maintains operational subledgers and balanced export journals. It does
not file taxes or decide official tax depreciation. Before the first tax filing,
a CPA or bookkeeper should approve the accounting method, inventory treatment,
capitalization threshold, sales-tax treatment, and opening balances.
