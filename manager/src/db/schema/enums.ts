import { pgEnum } from "drizzle-orm/pg-core";

export const organizationStatusEnum = pgEnum("organization_status", [
  "active",
  "suspended",
  "archived",
]);

export const staffStatusEnum = pgEnum("staff_status", [
  "invited",
  "active",
  "suspended",
  "departed",
]);

export const roleScopeEnum = pgEnum("role_scope", [
  "organization",
  "location",
]);

export const vendorStatusEnum = pgEnum("vendor_status", [
  "active",
  "inactive",
  "blocked",
]);

export const productTypeEnum = pgEnum("product_type", [
  "inventory",
  "non_inventory",
  "service",
  "finished_good",
]);

export const uomDimensionEnum = pgEnum("uom_dimension", [
  "count",
  "mass",
  "volume",
  "length",
  "time",
  "other",
]);

export const sourceDocumentTypeEnum = pgEnum("source_document_type", [
  "unknown",
  "invoice",
  "receipt",
  "credit_memo",
  "statement",
  "purchase_order",
  "packing_slip",
  "payroll",
  "other",
]);

export const sourceDocumentStatusEnum = pgEnum("source_document_status", [
  "received",
  "quarantined",
  "classified",
  "extracted",
  "matched",
  "validated",
  "needs_review",
  "auto_ready",
  "approved",
  "posted",
  "duplicate",
  "failure",
  "voided",
]);

export const extractionRunStatusEnum = pgEnum("extraction_run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const mappingStatusEnum = pgEnum("mapping_status", [
  "unmapped",
  "suggested",
  "confirmed",
  "rejected",
]);

export const purchaseTypeEnum = pgEnum("purchase_type", [
  "purchase_order",
  "invoice",
  "credit_memo",
]);

export const purchaseStatusEnum = pgEnum("purchase_status", [
  "draft",
  "open",
  "partially_received",
  "received",
  "posted",
  "voided",
  "reversed",
]);

export const purchaseLineTypeEnum = pgEnum("purchase_line_type", [
  "item",
  "shipping",
  "fee",
  "discount",
  "tax",
]);

export const goodsReceiptStatusEnum = pgEnum("goods_receipt_status", [
  "draft",
  "posted",
  "voided",
  "reversed",
]);

export const cardAccountTypeEnum = pgEnum("card_account_type", [
  "credit",
  "debit",
  "prepaid",
]);

export const cardTransactionStatusEnum = pgEnum("card_transaction_status", [
  "pending",
  "posted",
  "voided",
  "reversed",
]);

export const cardMatchStatusEnum = pgEnum("card_match_status", [
  "proposed",
  "confirmed",
  "rejected",
  "reversed",
]);

export const cardMatchMethodEnum = pgEnum("card_match_method", [
  "exact",
  "rule",
  "heuristic",
  "manual",
]);

export const inventoryCountStatusEnum = pgEnum("inventory_count_status", [
  "draft",
  "in_progress",
  "submitted",
  "posted",
  "voided",
]);

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "opening_balance",
  "goods_receipt",
  "purchase_return",
  "sale",
  "sale_return",
  "waste",
  "transfer_in",
  "transfer_out",
  "count_adjustment",
  "recipe_consumption",
  "recipe_production",
  "manual_adjustment",
  "reversal",
]);

export const recipeVersionStatusEnum = pgEnum("recipe_version_status", [
  "draft",
  "active",
  "retired",
]);

export const recipeComponentTypeEnum = pgEnum("recipe_component_type", [
  "product",
  "recipe",
]);

export const salesOrderStatusEnum = pgEnum("sales_order_status", [
  "open",
  "completed",
  "voided",
  "refunded",
  "partially_refunded",
]);

export const salesLineTypeEnum = pgEnum("sales_line_type", [
  "item",
  "fee",
  "discount",
]);

export const integrationDirectionEnum = pgEnum("integration_direction", [
  "inbound",
  "outbound",
]);

export const integrationEventStatusEnum = pgEnum(
  "integration_event_status",
  [
    "received",
    "pending",
    "processing",
    "succeeded",
    "failed",
    "dead_lettered",
    "ignored",
  ],
);

export const settlementStatusEnum = pgEnum("settlement_status", [
  "pending",
  "paid",
  "failed",
  "reversed",
]);

export const settlementLineTypeEnum = pgEnum("settlement_line_type", [
  "sale",
  "refund",
  "fee",
  "tip",
  "tax",
  "adjustment",
  "chargeback",
  "reserve",
]);

export const accountingPeriodStatusEnum = pgEnum(
  "accounting_period_status",
  ["open", "soft_closed", "closed"],
);

export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

export const normalBalanceEnum = pgEnum("normal_balance", [
  "debit",
  "credit",
]);

export const journalBatchStatusEnum = pgEnum("journal_batch_status", [
  "draft",
  "posted",
  "reversed",
]);

export const payrollRunStatusEnum = pgEnum("payroll_run_status", [
  "draft",
  "posted",
  "voided",
]);

export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "staff",
  "system",
  "integration",
]);
