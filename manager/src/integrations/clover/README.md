# Clover manager ingestion

This module is a server-side, read-only foundation for importing Clover
Platform orders, payments, and refunds. It does not share storefront
credentials and exposes no create, update, refund, void, or delete methods.

## Configuration

Call `parseCloverManagerConfig()` only when the integration is enabled. It
requires these dedicated values:

- `CLOVER_MANAGER_API_TOKEN`
- `CLOVER_MANAGER_MERCHANT_ID`
- `CLOVER_MANAGER_WEBHOOK_SECRET`
- `CLOVER_MANAGER_READ_SCOPES`
- `CLOVER_MANAGER_ENVIRONMENT` (`sandbox` by default)

`CLOVER_MANAGER_READ_SCOPES` is a comma-separated allowlisted declaration. It
must include `ORDERS_R` and `PAYMENTS_R`; any write or unknown scope is
rejected. Optional timeout, retry, page-size, and Platform webhook auth-code
settings are defined in `config.ts`.

## Webhooks

Clover uses two different authenticity mechanisms:

- Hosted Checkout uses `Clover-Signature`, an HMAC-SHA256 over
  `<timestamp>.<exact raw request bytes>`.
- Platform event notifications use the static `X-Clover-Auth` code.

The helpers fail closed for missing configuration, invalid signatures, stale
timestamps, malformed JSON, or invalid payloads. Signature verification must
receive the unmodified raw body before JSON parsing.

## Controls

Normalize fetched objects before persistence. External keys identify the
current provider object; version and webhook keys support replay-safe
processing. Daily controls use the configured IANA business timezone, count
only `SUCCESS` payments, de-duplicate object replays, and report refunds,
taxes, tips, tenders, source channels, and exact reconciliation differences.
