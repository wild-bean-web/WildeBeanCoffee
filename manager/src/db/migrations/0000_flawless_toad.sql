CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."accounting_period_status" AS ENUM('open', 'soft_closed', 'closed');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('staff', 'system', 'integration');--> statement-breakpoint
CREATE TYPE "public"."card_account_type" AS ENUM('credit', 'debit', 'prepaid');--> statement-breakpoint
CREATE TYPE "public"."card_match_method" AS ENUM('exact', 'rule', 'heuristic', 'manual');--> statement-breakpoint
CREATE TYPE "public"."card_match_status" AS ENUM('proposed', 'confirmed', 'rejected', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."card_transaction_status" AS ENUM('pending', 'posted', 'voided', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."extraction_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."goods_receipt_status" AS ENUM('draft', 'posted', 'voided', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."integration_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."integration_event_status" AS ENUM('received', 'pending', 'processing', 'succeeded', 'failed', 'dead_lettered', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."inventory_count_status" AS ENUM('draft', 'in_progress', 'submitted', 'posted', 'voided');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type" AS ENUM('opening_balance', 'goods_receipt', 'purchase_return', 'sale', 'sale_return', 'waste', 'transfer_in', 'transfer_out', 'count_adjustment', 'recipe_consumption', 'recipe_production', 'manual_adjustment', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."journal_batch_status" AS ENUM('draft', 'posted', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."mapping_status" AS ENUM('unmapped', 'suggested', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."normal_balance" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('inventory', 'non_inventory', 'service', 'finished_good');--> statement-breakpoint
CREATE TYPE "public"."purchase_line_type" AS ENUM('item', 'shipping', 'fee', 'discount', 'tax');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('draft', 'open', 'partially_received', 'received', 'posted', 'voided', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."purchase_type" AS ENUM('purchase_order', 'invoice', 'credit_memo');--> statement-breakpoint
CREATE TYPE "public"."recipe_component_type" AS ENUM('product', 'recipe');--> statement-breakpoint
CREATE TYPE "public"."recipe_version_status" AS ENUM('draft', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."role_scope" AS ENUM('organization', 'location');--> statement-breakpoint
CREATE TYPE "public"."sales_line_type" AS ENUM('item', 'fee', 'discount');--> statement-breakpoint
CREATE TYPE "public"."sales_order_status" AS ENUM('open', 'completed', 'voided', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."settlement_line_type" AS ENUM('sale', 'refund', 'fee', 'tip', 'tax', 'adjustment', 'chargeback', 'reserve');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'paid', 'failed', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."source_document_status" AS ENUM('received', 'quarantined', 'classified', 'extracted', 'matched', 'validated', 'needs_review', 'auto_ready', 'approved', 'posted', 'duplicate', 'failure', 'voided');--> statement-breakpoint
CREATE TYPE "public"."source_document_type" AS ENUM('unknown', 'invoice', 'receipt', 'credit_memo', 'statement', 'purchase_order', 'packing_slip', 'other');--> statement-breakpoint
CREATE TYPE "public"."staff_status" AS ENUM('invited', 'active', 'suspended', 'departed');--> statement-breakpoint
CREATE TYPE "public"."uom_dimension" AS ENUM('count', 'mass', 'volume', 'length', 'time', 'other');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('active', 'inactive', 'blocked');--> statement-breakpoint
CREATE TABLE "accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period_number" smallint NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" "accounting_period_status" DEFAULT 'open' NOT NULL,
	"soft_closed_at" timestamp (3) with time zone,
	"closed_at" timestamp (3) with time zone,
	"closed_by_staff_member_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_period_number_positive" CHECK ("accounting_periods"."period_number" > 0),
	CONSTRAINT "accounting_period_dates_ordered" CHECK ("accounting_periods"."ends_on" >= "accounting_periods"."starts_on"),
	CONSTRAINT "accounting_period_close_state" CHECK (
        ("accounting_periods"."status" = 'open' and "accounting_periods"."closed_at" is null)
        or ("accounting_periods"."status" = 'soft_closed' and "accounting_periods"."soft_closed_at" is not null and "accounting_periods"."closed_at" is null)
        or ("accounting_periods"."status" = 'closed' and "accounting_periods"."closed_at" is not null)
      )
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"account_type" "account_type" NOT NULL,
	"normal_balance" "normal_balance" NOT NULL,
	"parent_account_id" uuid,
	"external_id" text,
	"allow_posting" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_code_not_blank" CHECK (btrim("accounts"."code") <> ''),
	CONSTRAINT "account_name_not_blank" CHECK (btrim("accounts"."name") <> ''),
	CONSTRAINT "account_parent_not_self" CHECK ("accounts"."parent_account_id" is null or "accounts"."parent_account_id" <> "accounts"."id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" bigserial NOT NULL,
	"organization_id" uuid NOT NULL,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"recorded_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_staff_member_id" uuid,
	"actor_external_id" text,
	"source_system" varchar(96) NOT NULL,
	"action" varchar(128) NOT NULL,
	"entity_type" varchar(128) NOT NULL,
	"entity_id" uuid,
	"entity_external_id" text,
	"request_id" uuid,
	"correlation_id" uuid,
	"causation_id" uuid,
	"previous_audit_event_id" uuid,
	"previous_event_hash" varchar(64),
	"event_hash" varchar(64) NOT NULL,
	"event_data" jsonb NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	CONSTRAINT "audit_event_source_not_blank" CHECK (btrim("audit_events"."source_system") <> ''),
	CONSTRAINT "audit_event_action_not_blank" CHECK (btrim("audit_events"."action") <> ''),
	CONSTRAINT "audit_event_entity_type_not_blank" CHECK (btrim("audit_events"."entity_type") <> ''),
	CONSTRAINT "audit_event_entity_identity" CHECK ("audit_events"."entity_id" is not null or "audit_events"."entity_external_id" is not null),
	CONSTRAINT "audit_event_actor_identity" CHECK (
        ("audit_events"."actor_type" <> 'staff' or "audit_events"."actor_staff_member_id" is not null)
        and ("audit_events"."actor_type" = 'staff' or "audit_events"."actor_staff_member_id" is null)
      ),
	CONSTRAINT "audit_event_recorded_after_occurred" CHECK ("audit_events"."recorded_at" >= "audit_events"."occurred_at"),
	CONSTRAINT "audit_event_hash_format" CHECK ("audit_events"."event_hash" ~ '^[0-9a-fA-F]{64}$'),
	CONSTRAINT "audit_event_previous_hash_format" CHECK ("audit_events"."previous_event_hash" is null or "audit_events"."previous_event_hash" ~ '^[0-9a-fA-F]{64}$'),
	CONSTRAINT "audit_event_chain_pair" CHECK (("audit_events"."previous_audit_event_id" is null) = ("audit_events"."previous_event_hash" is null)),
	CONSTRAINT "audit_event_previous_not_self" CHECK ("audit_events"."previous_audit_event_id" is null or "audit_events"."previous_audit_event_id" <> "audit_events"."id")
);
--> statement-breakpoint
CREATE TABLE "card_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"account_type" "card_account_type" NOT NULL,
	"issuer" varchar(96) NOT NULL,
	"last_four" varchar(4) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"source_system" varchar(96) NOT NULL,
	"external_id" text NOT NULL,
	"ledger_account_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_account_name_not_blank" CHECK (btrim("card_accounts"."name") <> ''),
	CONSTRAINT "card_account_source_not_blank" CHECK (btrim("card_accounts"."source_system") <> ''),
	CONSTRAINT "card_account_last_four_digits" CHECK ("card_accounts"."last_four" ~ '^[0-9]{4}$'),
	CONSTRAINT "card_account_currency_iso_code" CHECK ("card_accounts"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "card_transaction_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"card_transaction_id" uuid NOT NULL,
	"purchase_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"status" "card_match_status" DEFAULT 'proposed' NOT NULL,
	"method" "card_match_method" NOT NULL,
	"matched_amount_cents" integer NOT NULL,
	"confidence" numeric(7, 6),
	"rationale" text,
	"matched_by_staff_member_id" uuid,
	"supersedes_match_id" uuid,
	"reversal_of_match_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_match_revision_positive" CHECK ("card_transaction_matches"."revision_number" > 0),
	CONSTRAINT "card_match_amount_positive" CHECK ("card_transaction_matches"."matched_amount_cents" > 0),
	CONSTRAINT "card_match_confidence_range" CHECK ("card_transaction_matches"."confidence" is null or ("card_transaction_matches"."confidence" >= 0 and "card_transaction_matches"."confidence" <= 1)),
	CONSTRAINT "card_match_not_self_superseded" CHECK ("card_transaction_matches"."supersedes_match_id" is null or "card_transaction_matches"."supersedes_match_id" <> "card_transaction_matches"."id"),
	CONSTRAINT "card_match_not_self_reversed" CHECK ("card_transaction_matches"."reversal_of_match_id" is null or "card_transaction_matches"."reversal_of_match_id" <> "card_transaction_matches"."id")
);
--> statement-breakpoint
CREATE TABLE "card_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"card_account_id" uuid NOT NULL,
	"location_id" uuid,
	"source_document_id" uuid,
	"source_system" varchar(96) NOT NULL,
	"external_id" text NOT NULL,
	"status" "card_transaction_status" DEFAULT 'pending' NOT NULL,
	"authorized_at" timestamp (3) with time zone,
	"posted_on" date,
	"merchant_name" text NOT NULL,
	"normalized_merchant_name" text,
	"merchant_category_code" varchar(8),
	"authorization_code" varchar(64),
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reversal_of_card_transaction_id" uuid,
	"supersedes_card_transaction_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_tx_source_not_blank" CHECK (btrim("card_transactions"."source_system") <> ''),
	CONSTRAINT "card_tx_merchant_not_blank" CHECK (btrim("card_transactions"."merchant_name") <> ''),
	CONSTRAINT "card_tx_amount_nonzero" CHECK ("card_transactions"."amount_cents" <> 0),
	CONSTRAINT "card_tx_currency_iso_code" CHECK ("card_transactions"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "card_tx_reversal_not_self" CHECK ("card_transactions"."reversal_of_card_transaction_id" is null or "card_transactions"."reversal_of_card_transaction_id" <> "card_transactions"."id"),
	CONSTRAINT "card_tx_supersedes_not_self" CHECK ("card_transactions"."supersedes_card_transaction_id" is null or "card_transactions"."supersedes_card_transaction_id" <> "card_transactions"."id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sku" varchar(96) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"product_type" "product_type" NOT NULL,
	"inventory_uom_id" uuid NOT NULL,
	"category" text,
	"barcode" varchar(64),
	"external_id" text,
	"default_unit_cost_cents" numeric(20, 6),
	"track_inventory" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_sku_not_blank" CHECK (btrim("products"."sku") <> ''),
	CONSTRAINT "product_name_not_blank" CHECK (btrim("products"."name") <> ''),
	CONSTRAINT "product_default_cost_nonnegative" CHECK ("products"."default_unit_cost_cents" is null or "products"."default_unit_cost_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_item_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"external_id" text,
	"pack_uom_id" uuid NOT NULL,
	"contained_quantity" numeric(20, 6) NOT NULL,
	"contained_uom_id" uuid NOT NULL,
	"minimum_order_packs" numeric(20, 6),
	"is_default" boolean DEFAULT false NOT NULL,
	"effective_from" date DEFAULT current_date NOT NULL,
	"effective_to" date,
	"supersedes_purchase_pack_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_pack_code_not_blank" CHECK (btrim("purchase_packs"."code") <> ''),
	CONSTRAINT "purchase_pack_quantity_positive" CHECK ("purchase_packs"."contained_quantity" > 0),
	CONSTRAINT "purchase_pack_minimum_positive" CHECK ("purchase_packs"."minimum_order_packs" is null or "purchase_packs"."minimum_order_packs" > 0),
	CONSTRAINT "purchase_pack_dates_ordered" CHECK ("purchase_packs"."effective_to" is null or "purchase_packs"."effective_to" >= "purchase_packs"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "units_of_measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"symbol" varchar(16) NOT NULL,
	"dimension" "uom_dimension" NOT NULL,
	"decimal_places" smallint DEFAULT 3 NOT NULL,
	"is_dimension_base" boolean DEFAULT false NOT NULL,
	"external_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uom_code_not_blank" CHECK (btrim("units_of_measure"."code") <> ''),
	CONSTRAINT "uom_decimal_places_range" CHECK ("units_of_measure"."decimal_places" between 0 and 12)
);
--> statement-breakpoint
CREATE TABLE "uom_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid,
	"from_uom_id" uuid NOT NULL,
	"to_uom_id" uuid NOT NULL,
	"multiplier" numeric(24, 12) NOT NULL,
	"offset" numeric(24, 12) DEFAULT '0' NOT NULL,
	"effective_from" date DEFAULT current_date NOT NULL,
	"effective_to" date,
	"supersedes_conversion_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uom_conversion_distinct_units" CHECK ("uom_conversions"."from_uom_id" <> "uom_conversions"."to_uom_id"),
	CONSTRAINT "uom_conversion_multiplier_positive" CHECK ("uom_conversions"."multiplier" > 0),
	CONSTRAINT "uom_conversion_dates_ordered" CHECK ("uom_conversions"."effective_to" is null or "uom_conversions"."effective_to" >= "uom_conversions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "vendor_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"product_id" uuid,
	"purchase_uom_id" uuid NOT NULL,
	"vendor_sku" varchar(128) NOT NULL,
	"description" text NOT NULL,
	"manufacturer_part_number" varchar(128),
	"external_id" text,
	"minimum_order_quantity" numeric(20, 6),
	"lead_time_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_item_sku_not_blank" CHECK (btrim("vendor_items"."vendor_sku") <> ''),
	CONSTRAINT "vendor_item_minimum_positive" CHECK ("vendor_items"."minimum_order_quantity" is null or "vendor_items"."minimum_order_quantity" > 0),
	CONSTRAINT "vendor_item_lead_time_nonnegative" CHECK ("vendor_items"."lead_time_days" is null or "vendor_items"."lead_time_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"external_id" text,
	"status" "vendor_status" DEFAULT 'active' NOT NULL,
	"default_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"payment_terms_days" integer,
	"tax_identifier" text,
	"contact" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_code_not_blank" CHECK (btrim("vendors"."code") <> ''),
	CONSTRAINT "vendor_name_not_blank" CHECK (btrim("vendors"."name") <> ''),
	CONSTRAINT "vendor_currency_iso_code" CHECK ("vendors"."default_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "vendor_terms_nonnegative" CHECK ("vendors"."payment_terms_days" is null or "vendors"."payment_terms_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"external_id" text,
	"timezone" varchar(64) NOT NULL,
	"address" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"opened_on" date,
	"closed_on" date,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_code_not_blank" CHECK (btrim("locations"."code") <> ''),
	CONSTRAINT "location_name_not_blank" CHECK (btrim("locations"."name") <> ''),
	CONSTRAINT "location_dates_ordered" CHECK ("locations"."closed_on" is null or "locations"."opened_on" is null or "locations"."closed_on" >= "locations"."opened_on")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"base_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"status" "organization_status" DEFAULT 'active' NOT NULL,
	"tax_identifier" text,
	"external_id" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_slug_not_blank" CHECK (btrim("organizations"."slug") <> ''),
	CONSTRAINT "org_currency_iso_code" CHECK ("organizations"."base_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "org_timezone_not_blank" CHECK (btrim("organizations"."timezone") <> '')
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"auth_user_id" uuid,
	"employee_number" varchar(64),
	"external_id" text,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"legal_name" text,
	"status" "staff_status" DEFAULT 'invited' NOT NULL,
	"hired_on" date,
	"terminated_on" date,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_email_not_blank" CHECK (btrim("staff_members"."email") <> ''),
	CONSTRAINT "staff_name_not_blank" CHECK (btrim("staff_members"."display_name") <> ''),
	CONSTRAINT "staff_dates_ordered" CHECK ("staff_members"."terminated_on" is null or "staff_members"."hired_on" is null or "staff_members"."terminated_on" >= "staff_members"."hired_on")
);
--> statement-breakpoint
CREATE TABLE "staff_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"staff_role_id" uuid NOT NULL,
	"location_id" uuid,
	"effective_from" date DEFAULT current_date NOT NULL,
	"effective_to" date,
	"assigned_by_staff_member_id" uuid,
	"revoked_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_assign_dates_ordered" CHECK ("staff_role_assignments"."effective_to" is null or "staff_role_assignments"."effective_to" >= "staff_role_assignments"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "staff_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scope" "role_scope" NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_role_key_not_blank" CHECK (btrim("staff_roles"."key") <> ''),
	CONSTRAINT "staff_role_name_not_blank" CHECK (btrim("staff_roles"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "document_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"extraction_run_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"source_line_id" text,
	"description" text NOT NULL,
	"vendor_sku" varchar(128),
	"quantity" numeric(20, 6),
	"uom_text" varchar(64),
	"unit_cost_cents" numeric(20, 6),
	"subtotal_cents" integer,
	"tax_cents" integer,
	"total_cents" integer,
	"service_date" date,
	"confidence" numeric(7, 6),
	"bounding_box" jsonb,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_line_number_positive" CHECK ("document_lines"."line_number" > 0),
	CONSTRAINT "document_line_description_not_blank" CHECK (btrim("document_lines"."description") <> ''),
	CONSTRAINT "document_line_unit_cost_nonnegative" CHECK ("document_lines"."unit_cost_cents" is null or "document_lines"."unit_cost_cents" >= 0),
	CONSTRAINT "document_line_confidence_range" CHECK ("document_lines"."confidence" is null or ("document_lines"."confidence" >= 0 and "document_lines"."confidence" <= 1))
);
--> statement-breakpoint
CREATE TABLE "extraction_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"run_number" integer NOT NULL,
	"provider" varchar(96) NOT NULL,
	"model" varchar(128),
	"parser_version" varchar(64),
	"prompt_version" varchar(64),
	"status" "extraction_run_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp (3) with time zone,
	"finished_at" timestamp (3) with time zone,
	"confidence" numeric(7, 6),
	"raw_output" jsonb,
	"error_message" text,
	"supersedes_run_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extraction_run_number_positive" CHECK ("extraction_runs"."run_number" > 0),
	CONSTRAINT "extraction_run_confidence_range" CHECK ("extraction_runs"."confidence" is null or ("extraction_runs"."confidence" >= 0 and "extraction_runs"."confidence" <= 1)),
	CONSTRAINT "extraction_run_times_ordered" CHECK ("extraction_runs"."finished_at" is null or "extraction_runs"."started_at" is null or "extraction_runs"."finished_at" >= "extraction_runs"."started_at"),
	CONSTRAINT "extraction_run_not_self_superseded" CHECK ("extraction_runs"."supersedes_run_id" is null or "extraction_runs"."supersedes_run_id" <> "extraction_runs"."id")
);
--> statement-breakpoint
CREATE TABLE "mapping_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_line_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"status" "mapping_status" DEFAULT 'unmapped' NOT NULL,
	"product_id" uuid,
	"vendor_item_id" uuid,
	"purchase_pack_id" uuid,
	"mapped_quantity" numeric(20, 6),
	"mapped_uom_id" uuid,
	"confidence" numeric(7, 6),
	"rationale" text,
	"created_by_staff_member_id" uuid,
	"supersedes_mapping_revision_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mapping_revision_number_positive" CHECK ("mapping_revisions"."revision_number" > 0),
	CONSTRAINT "mapping_revision_confidence_range" CHECK ("mapping_revisions"."confidence" is null or ("mapping_revisions"."confidence" >= 0 and "mapping_revisions"."confidence" <= 1)),
	CONSTRAINT "mapping_revision_quantity_uom_pair" CHECK (("mapping_revisions"."mapped_quantity" is null) = ("mapping_revisions"."mapped_uom_id" is null)),
	CONSTRAINT "mapping_revision_confirmed_target" CHECK ("mapping_revisions"."status" <> 'confirmed' or coalesce("mapping_revisions"."product_id", "mapping_revisions"."vendor_item_id", "mapping_revisions"."purchase_pack_id") is not null),
	CONSTRAINT "mapping_revision_not_self_superseded" CHECK ("mapping_revisions"."supersedes_mapping_revision_id" is null or "mapping_revisions"."supersedes_mapping_revision_id" <> "mapping_revisions"."id")
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"vendor_id" uuid,
	"document_type" "source_document_type" DEFAULT 'unknown' NOT NULL,
	"status" "source_document_status" DEFAULT 'received' NOT NULL,
	"source_system" varchar(96) NOT NULL,
	"external_id" text,
	"storage_key" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"byte_size" bigint,
	"sha256" varchar(64) NOT NULL,
	"received_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"document_date" date,
	"currency" varchar(3),
	"total_cents" integer,
	"supersedes_document_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_doc_source_not_blank" CHECK (btrim("source_documents"."source_system") <> ''),
	CONSTRAINT "source_doc_storage_not_blank" CHECK (btrim("source_documents"."storage_key") <> ''),
	CONSTRAINT "source_doc_sha256_format" CHECK ("source_documents"."sha256" ~ '^[0-9a-fA-F]{64}$'),
	CONSTRAINT "source_doc_byte_size_nonnegative" CHECK ("source_documents"."byte_size" is null or "source_documents"."byte_size" >= 0),
	CONSTRAINT "source_doc_currency_iso_code" CHECK ("source_documents"."currency" is null or "source_documents"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "source_doc_not_self_superseded" CHECK ("source_documents"."supersedes_document_id" is null or "source_documents"."supersedes_document_id" <> "source_documents"."id")
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"source_system" varchar(96) NOT NULL,
	"direction" "integration_direction" NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"external_event_id" text,
	"idempotency_key" text NOT NULL,
	"status" "integration_event_status" DEFAULT 'received' NOT NULL,
	"aggregate_type" varchar(96),
	"aggregate_id" uuid,
	"aggregate_version" integer,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"received_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"processing_started_at" timestamp (3) with time zone,
	"processed_at" timestamp (3) with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp (3) with time zone,
	"correlation_id" uuid,
	"causation_event_id" uuid,
	"supersedes_event_id" uuid,
	"payload" jsonb NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_event_source_not_blank" CHECK (btrim("integration_events"."source_system") <> ''),
	CONSTRAINT "integration_event_type_not_blank" CHECK (btrim("integration_events"."event_type") <> ''),
	CONSTRAINT "integration_event_key_not_blank" CHECK (btrim("integration_events"."idempotency_key") <> ''),
	CONSTRAINT "integration_event_attempts_nonnegative" CHECK ("integration_events"."attempt_count" >= 0),
	CONSTRAINT "integration_event_version_positive" CHECK ("integration_events"."aggregate_version" is null or "integration_events"."aggregate_version" > 0),
	CONSTRAINT "integration_event_aggregate_pair" CHECK (("integration_events"."aggregate_type" is null) = ("integration_events"."aggregate_id" is null)),
	CONSTRAINT "integration_event_times_ordered" CHECK (
        "integration_events"."processed_at" is null
        or "integration_events"."processing_started_at" is null
        or "integration_events"."processed_at" >= "integration_events"."processing_started_at"
      ),
	CONSTRAINT "integration_event_causation_not_self" CHECK ("integration_events"."causation_event_id" is null or "integration_events"."causation_event_id" <> "integration_events"."id"),
	CONSTRAINT "integration_event_supersedes_not_self" CHECK ("integration_events"."supersedes_event_id" is null or "integration_events"."supersedes_event_id" <> "integration_events"."id")
);
--> statement-breakpoint
CREATE TABLE "inventory_count_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"count_session_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"product_id" uuid NOT NULL,
	"uom_id" uuid NOT NULL,
	"lot_code" varchar(128),
	"expected_quantity" numeric(20, 6),
	"counted_quantity" numeric(20, 6),
	"variance_quantity" numeric(20, 6),
	"unit_cost_cents" numeric(20, 6),
	"variance_cost_cents" integer,
	"counted_by_staff_member_id" uuid,
	"counted_at" timestamp (3) with time zone,
	"notes" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_count_line_number_positive" CHECK ("inventory_count_lines"."line_number" > 0),
	CONSTRAINT "inventory_count_line_expected_nonnegative" CHECK ("inventory_count_lines"."expected_quantity" is null or "inventory_count_lines"."expected_quantity" >= 0),
	CONSTRAINT "inventory_count_line_counted_nonnegative" CHECK ("inventory_count_lines"."counted_quantity" is null or "inventory_count_lines"."counted_quantity" >= 0),
	CONSTRAINT "inventory_count_line_variance" CHECK (
        (
          "inventory_count_lines"."expected_quantity" is not null
          and "inventory_count_lines"."counted_quantity" is not null
          and "inventory_count_lines"."variance_quantity" = "inventory_count_lines"."counted_quantity" - "inventory_count_lines"."expected_quantity"
        )
        or (
          ("inventory_count_lines"."expected_quantity" is null or "inventory_count_lines"."counted_quantity" is null)
          and "inventory_count_lines"."variance_quantity" is null
        )
      ),
	CONSTRAINT "inventory_count_line_unit_cost_nonnegative" CHECK ("inventory_count_lines"."unit_cost_cents" is null or "inventory_count_lines"."unit_cost_cents" >= 0),
	CONSTRAINT "inventory_count_line_counted_timestamp" CHECK ("inventory_count_lines"."counted_quantity" is null or "inventory_count_lines"."counted_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "inventory_count_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"count_number" varchar(96) NOT NULL,
	"source_system" varchar(96),
	"external_id" text,
	"status" "inventory_count_status" DEFAULT 'draft' NOT NULL,
	"as_of" timestamp (3) with time zone NOT NULL,
	"started_at" timestamp (3) with time zone,
	"submitted_at" timestamp (3) with time zone,
	"posted_at" timestamp (3) with time zone,
	"created_by_staff_member_id" uuid,
	"approved_by_staff_member_id" uuid,
	"supersedes_count_session_id" uuid,
	"notes" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_count_number_not_blank" CHECK (btrim("inventory_count_sessions"."count_number") <> ''),
	CONSTRAINT "inventory_count_times_ordered" CHECK (
        ("inventory_count_sessions"."started_at" is null or "inventory_count_sessions"."started_at" <= "inventory_count_sessions"."as_of")
        and ("inventory_count_sessions"."submitted_at" is null or "inventory_count_sessions"."started_at" is null or "inventory_count_sessions"."submitted_at" >= "inventory_count_sessions"."started_at")
        and ("inventory_count_sessions"."posted_at" is null or "inventory_count_sessions"."submitted_at" is null or "inventory_count_sessions"."posted_at" >= "inventory_count_sessions"."submitted_at")
      ),
	CONSTRAINT "inventory_count_submission_state" CHECK ("inventory_count_sessions"."status" not in ('submitted', 'posted') or "inventory_count_sessions"."submitted_at" is not null),
	CONSTRAINT "inventory_count_posting_state" CHECK ("inventory_count_sessions"."status" <> 'posted' or "inventory_count_sessions"."posted_at" is not null),
	CONSTRAINT "inventory_count_not_self_superseded" CHECK ("inventory_count_sessions"."supersedes_count_session_id" is null or "inventory_count_sessions"."supersedes_count_session_id" <> "inventory_count_sessions"."id")
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"uom_id" uuid NOT NULL,
	"movement_type" "inventory_movement_type" NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"unit_cost_cents" numeric(20, 6),
	"extended_cost_cents" integer,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"business_date" date NOT NULL,
	"lot_code" varchar(128),
	"source_system" varchar(96),
	"external_id" text,
	"movement_group_id" uuid,
	"goods_receipt_line_id" uuid,
	"purchase_line_id" uuid,
	"sales_order_line_id" uuid,
	"inventory_count_line_id" uuid,
	"recipe_version_id" uuid,
	"counterpart_movement_id" uuid,
	"reversal_of_movement_id" uuid,
	"supersedes_movement_id" uuid,
	"created_by_staff_member_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_movement_quantity_nonzero" CHECK ("inventory_movements"."quantity" <> 0),
	CONSTRAINT "inventory_movement_unit_cost_nonnegative" CHECK ("inventory_movements"."unit_cost_cents" is null or "inventory_movements"."unit_cost_cents" >= 0),
	CONSTRAINT "inventory_movement_transfer_group" CHECK ("inventory_movements"."movement_type" not in ('transfer_in', 'transfer_out') or "inventory_movements"."movement_group_id" is not null),
	CONSTRAINT "inventory_movement_receipt_source" CHECK ("inventory_movements"."movement_type" <> 'goods_receipt' or "inventory_movements"."goods_receipt_line_id" is not null),
	CONSTRAINT "inventory_movement_sale_source" CHECK ("inventory_movements"."movement_type" not in ('sale', 'sale_return') or "inventory_movements"."sales_order_line_id" is not null),
	CONSTRAINT "inventory_movement_count_source" CHECK ("inventory_movements"."movement_type" <> 'count_adjustment' or "inventory_movements"."inventory_count_line_id" is not null),
	CONSTRAINT "inventory_movement_recipe_source" CHECK ("inventory_movements"."movement_type" not in ('recipe_consumption', 'recipe_production') or "inventory_movements"."recipe_version_id" is not null),
	CONSTRAINT "inventory_movement_reversal_source" CHECK ("inventory_movements"."movement_type" <> 'reversal' or "inventory_movements"."reversal_of_movement_id" is not null),
	CONSTRAINT "inventory_movement_counterpart_not_self" CHECK ("inventory_movements"."counterpart_movement_id" is null or "inventory_movements"."counterpart_movement_id" <> "inventory_movements"."id"),
	CONSTRAINT "inventory_movement_reversal_not_self" CHECK ("inventory_movements"."reversal_of_movement_id" is null or "inventory_movements"."reversal_of_movement_id" <> "inventory_movements"."id"),
	CONSTRAINT "inventory_movement_supersedes_not_self" CHECK ("inventory_movements"."supersedes_movement_id" is null or "inventory_movements"."supersedes_movement_id" <> "inventory_movements"."id")
);
--> statement-breakpoint
CREATE TABLE "journal_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"accounting_period_id" uuid NOT NULL,
	"batch_number" varchar(96) NOT NULL,
	"journal_date" date NOT NULL,
	"status" "journal_batch_status" DEFAULT 'draft' NOT NULL,
	"description" text NOT NULL,
	"source_system" varchar(96),
	"source_type" varchar(96),
	"source_id" uuid,
	"external_id" text,
	"control_debit_cents" integer DEFAULT 0 NOT NULL,
	"control_credit_cents" integer DEFAULT 0 NOT NULL,
	"posted_at" timestamp (3) with time zone,
	"posted_by_staff_member_id" uuid,
	"reversal_of_journal_batch_id" uuid,
	"supersedes_journal_batch_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_batch_number_not_blank" CHECK (btrim("journal_batches"."batch_number") <> ''),
	CONSTRAINT "journal_batch_description_not_blank" CHECK (btrim("journal_batches"."description") <> ''),
	CONSTRAINT "journal_batch_source_pair" CHECK (("journal_batches"."source_type" is null) = ("journal_batches"."source_id" is null)),
	CONSTRAINT "journal_batch_control_nonnegative" CHECK ("journal_batches"."control_debit_cents" >= 0 and "journal_batches"."control_credit_cents" >= 0),
	CONSTRAINT "journal_batch_control_balanced" CHECK ("journal_batches"."control_debit_cents" = "journal_batches"."control_credit_cents"),
	CONSTRAINT "journal_batch_posted_state" CHECK ("journal_batches"."status" = 'draft' or "journal_batches"."posted_at" is not null),
	CONSTRAINT "journal_batch_reversal_not_self" CHECK ("journal_batches"."reversal_of_journal_batch_id" is null or "journal_batches"."reversal_of_journal_batch_id" <> "journal_batches"."id"),
	CONSTRAINT "journal_batch_supersedes_not_self" CHECK ("journal_batches"."supersedes_journal_batch_id" is null or "journal_batches"."supersedes_journal_batch_id" <> "journal_batches"."id")
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"journal_batch_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"external_id" text,
	"account_id" uuid NOT NULL,
	"location_id" uuid,
	"description" text,
	"debit_cents" integer DEFAULT 0 NOT NULL,
	"credit_cents" integer DEFAULT 0 NOT NULL,
	"foreign_currency" varchar(3),
	"foreign_amount_cents" integer,
	"exchange_rate" numeric(20, 10),
	"purchase_line_id" uuid,
	"card_transaction_id" uuid,
	"inventory_movement_id" uuid,
	"sales_order_line_id" uuid,
	"settlement_line_id" uuid,
	"reversal_of_journal_line_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_line_number_positive" CHECK ("journal_lines"."line_number" > 0),
	CONSTRAINT "journal_line_one_sided_amount" CHECK (
        ("journal_lines"."debit_cents" > 0 and "journal_lines"."credit_cents" = 0)
        or ("journal_lines"."credit_cents" > 0 and "journal_lines"."debit_cents" = 0)
      ),
	CONSTRAINT "journal_line_foreign_values" CHECK (
        (
          "journal_lines"."foreign_currency" is null
          and "journal_lines"."foreign_amount_cents" is null
          and "journal_lines"."exchange_rate" is null
        )
        or (
          "journal_lines"."foreign_currency" ~ '^[A-Z]{3}$'
          and "journal_lines"."foreign_amount_cents" is not null
          and "journal_lines"."exchange_rate" > 0
        )
      ),
	CONSTRAINT "journal_line_single_source" CHECK (
        num_nonnulls(
          "journal_lines"."purchase_line_id",
          "journal_lines"."card_transaction_id",
          "journal_lines"."inventory_movement_id",
          "journal_lines"."sales_order_line_id",
          "journal_lines"."settlement_line_id"
        ) <= 1
      ),
	CONSTRAINT "journal_line_reversal_not_self" CHECK ("journal_lines"."reversal_of_journal_line_id" is null or "journal_lines"."reversal_of_journal_line_id" <> "journal_lines"."id")
);
--> statement-breakpoint
CREATE TABLE "goods_receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"purchase_line_id" uuid,
	"line_number" integer NOT NULL,
	"product_id" uuid NOT NULL,
	"uom_id" uuid NOT NULL,
	"expected_quantity" numeric(20, 6),
	"accepted_quantity" numeric(20, 6) NOT NULL,
	"rejected_quantity" numeric(20, 6) DEFAULT '0' NOT NULL,
	"unit_cost_cents" numeric(20, 6),
	"lot_code" varchar(128),
	"expires_on" date,
	"notes" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipt_line_number_positive" CHECK ("goods_receipt_lines"."line_number" > 0),
	CONSTRAINT "goods_receipt_line_expected_nonnegative" CHECK ("goods_receipt_lines"."expected_quantity" is null or "goods_receipt_lines"."expected_quantity" >= 0),
	CONSTRAINT "goods_receipt_line_accepted_nonnegative" CHECK ("goods_receipt_lines"."accepted_quantity" >= 0),
	CONSTRAINT "goods_receipt_line_rejected_nonnegative" CHECK ("goods_receipt_lines"."rejected_quantity" >= 0),
	CONSTRAINT "goods_receipt_line_cost_nonnegative" CHECK ("goods_receipt_lines"."unit_cost_cents" is null or "goods_receipt_lines"."unit_cost_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"purchase_id" uuid,
	"source_document_id" uuid,
	"receipt_number" varchar(96) NOT NULL,
	"source_system" varchar(96),
	"external_id" text,
	"status" "goods_receipt_status" DEFAULT 'draft' NOT NULL,
	"received_at" timestamp (3) with time zone NOT NULL,
	"received_by_staff_member_id" uuid,
	"posted_at" timestamp (3) with time zone,
	"reversal_of_goods_receipt_id" uuid,
	"supersedes_goods_receipt_id" uuid,
	"notes" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipt_number_not_blank" CHECK (btrim("goods_receipts"."receipt_number") <> ''),
	CONSTRAINT "goods_receipt_posting_state" CHECK ("goods_receipts"."status" not in ('posted', 'reversed') or "goods_receipts"."posted_at" is not null),
	CONSTRAINT "goods_receipt_reversal_not_self" CHECK ("goods_receipts"."reversal_of_goods_receipt_id" is null or "goods_receipts"."reversal_of_goods_receipt_id" <> "goods_receipts"."id"),
	CONSTRAINT "goods_receipt_supersedes_not_self" CHECK ("goods_receipts"."supersedes_goods_receipt_id" is null or "goods_receipts"."supersedes_goods_receipt_id" <> "goods_receipts"."id")
);
--> statement-breakpoint
CREATE TABLE "purchase_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"purchase_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"line_type" "purchase_line_type" DEFAULT 'item' NOT NULL,
	"product_id" uuid,
	"vendor_item_id" uuid,
	"purchase_pack_id" uuid,
	"source_document_line_id" uuid,
	"mapping_revision_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(20, 6),
	"uom_id" uuid,
	"unit_cost_cents" numeric(20, 6),
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"expected_on" date,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_line_number_positive" CHECK ("purchase_lines"."line_number" > 0),
	CONSTRAINT "purchase_line_description_not_blank" CHECK (btrim("purchase_lines"."description") <> ''),
	CONSTRAINT "purchase_line_quantity_uom_pair" CHECK (("purchase_lines"."quantity" is null) = ("purchase_lines"."uom_id" is null)),
	CONSTRAINT "purchase_line_item_fields" CHECK ("purchase_lines"."line_type" <> 'item' or ("purchase_lines"."product_id" is not null and "purchase_lines"."quantity" is not null and "purchase_lines"."uom_id" is not null and "purchase_lines"."unit_cost_cents" is not null)),
	CONSTRAINT "purchase_line_unit_cost_nonnegative" CHECK ("purchase_lines"."unit_cost_cents" is null or "purchase_lines"."unit_cost_cents" >= 0),
	CONSTRAINT "purchase_line_amounts_reconcile" CHECK ("purchase_lines"."total_cents" = "purchase_lines"."subtotal_cents" - "purchase_lines"."discount_cents" + "purchase_lines"."tax_cents")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"accounting_period_id" uuid,
	"source_document_id" uuid,
	"purchase_type" "purchase_type" NOT NULL,
	"status" "purchase_status" DEFAULT 'draft' NOT NULL,
	"purchase_number" varchar(96) NOT NULL,
	"source_system" varchar(96),
	"external_id" text,
	"purchase_date" date NOT NULL,
	"due_date" date,
	"currency" varchar(3) NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"tip_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"created_by_staff_member_id" uuid,
	"approved_by_staff_member_id" uuid,
	"posted_at" timestamp (3) with time zone,
	"reversal_of_purchase_id" uuid,
	"supersedes_purchase_id" uuid,
	"notes" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_number_not_blank" CHECK (btrim("purchases"."purchase_number") <> ''),
	CONSTRAINT "purchase_currency_iso_code" CHECK ("purchases"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "purchase_dates_ordered" CHECK ("purchases"."due_date" is null or "purchases"."due_date" >= "purchases"."purchase_date"),
	CONSTRAINT "purchase_amounts_reconcile" CHECK ("purchases"."total_cents" = "purchases"."subtotal_cents" - "purchases"."discount_cents" + "purchases"."tax_cents" + "purchases"."shipping_cents" + "purchases"."tip_cents"),
	CONSTRAINT "purchase_posting_state" CHECK ("purchases"."status" not in ('posted', 'reversed') or "purchases"."posted_at" is not null),
	CONSTRAINT "purchase_reversal_not_self" CHECK ("purchases"."reversal_of_purchase_id" is null or "purchases"."reversal_of_purchase_id" <> "purchases"."id"),
	CONSTRAINT "purchase_supersedes_not_self" CHECK ("purchases"."supersedes_purchase_id" is null or "purchases"."supersedes_purchase_id" <> "purchases"."id"),
	CONSTRAINT "purchase_distinct_revision_links" CHECK ("purchases"."reversal_of_purchase_id" is null or "purchases"."supersedes_purchase_id" is null or "purchases"."reversal_of_purchase_id" <> "purchases"."supersedes_purchase_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"recipe_version_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"component_type" "recipe_component_type" NOT NULL,
	"product_id" uuid,
	"nested_recipe_version_id" uuid,
	"quantity" numeric(20, 6) NOT NULL,
	"uom_id" uuid NOT NULL,
	"waste_factor" numeric(9, 8) DEFAULT '0' NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_component_line_positive" CHECK ("recipe_components"."line_number" > 0),
	CONSTRAINT "recipe_component_quantity_positive" CHECK ("recipe_components"."quantity" > 0),
	CONSTRAINT "recipe_component_waste_range" CHECK ("recipe_components"."waste_factor" >= 0 and "recipe_components"."waste_factor" < 1),
	CONSTRAINT "recipe_component_target" CHECK (
        (
          "recipe_components"."component_type" = 'product'
          and "recipe_components"."product_id" is not null
          and "recipe_components"."nested_recipe_version_id" is null
        )
        or (
          "recipe_components"."component_type" = 'recipe'
          and "recipe_components"."product_id" is null
          and "recipe_components"."nested_recipe_version_id" is not null
        )
      ),
	CONSTRAINT "recipe_component_not_self_nested" CHECK ("recipe_components"."nested_recipe_version_id" is null or "recipe_components"."nested_recipe_version_id" <> "recipe_components"."recipe_version_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "recipe_version_status" DEFAULT 'draft' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"yield_quantity" numeric(20, 6) NOT NULL,
	"yield_uom_id" uuid NOT NULL,
	"instructions" text,
	"created_by_staff_member_id" uuid,
	"approved_by_staff_member_id" uuid,
	"approved_at" timestamp (3) with time zone,
	"supersedes_recipe_version_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_version_number_positive" CHECK ("recipe_versions"."version_number" > 0),
	CONSTRAINT "recipe_version_yield_positive" CHECK ("recipe_versions"."yield_quantity" > 0),
	CONSTRAINT "recipe_version_dates_ordered" CHECK ("recipe_versions"."effective_to" is null or "recipe_versions"."effective_to" >= "recipe_versions"."effective_from"),
	CONSTRAINT "recipe_version_approval_state" CHECK ("recipe_versions"."status" <> 'active' or "recipe_versions"."approved_at" is not null),
	CONSTRAINT "recipe_version_not_self_superseded" CHECK ("recipe_versions"."supersedes_recipe_version_id" is null or "recipe_versions"."supersedes_recipe_version_id" <> "recipe_versions"."id")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"output_product_id" uuid NOT NULL,
	"code" varchar(96) NOT NULL,
	"name" text NOT NULL,
	"source_system" varchar(96),
	"external_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_code_not_blank" CHECK (btrim("recipes"."code") <> ''),
	CONSTRAINT "recipe_name_not_blank" CHECK (btrim("recipes"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "sales_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"external_id" text,
	"line_type" "sales_line_type" DEFAULT 'item' NOT NULL,
	"product_id" uuid,
	"recipe_version_id" uuid,
	"display_name" text NOT NULL,
	"quantity" numeric(20, 6) DEFAULT '1' NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"is_voided" boolean DEFAULT false NOT NULL,
	"voided_at" timestamp (3) with time zone,
	"reversal_of_sales_order_line_id" uuid,
	"supersedes_sales_order_line_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_order_line_number_positive" CHECK ("sales_order_lines"."line_number" > 0),
	CONSTRAINT "sales_order_line_name_not_blank" CHECK (btrim("sales_order_lines"."display_name") <> ''),
	CONSTRAINT "sales_order_line_quantity_nonzero" CHECK ("sales_order_lines"."quantity" <> 0),
	CONSTRAINT "sales_order_line_item_product" CHECK ("sales_order_lines"."line_type" <> 'item' or "sales_order_lines"."product_id" is not null),
	CONSTRAINT "sales_order_line_amounts_reconcile" CHECK ("sales_order_lines"."total_cents" = "sales_order_lines"."subtotal_cents" - "sales_order_lines"."discount_cents" + "sales_order_lines"."tax_cents"),
	CONSTRAINT "sales_order_line_void_state" CHECK (not "sales_order_lines"."is_voided" or "sales_order_lines"."voided_at" is not null),
	CONSTRAINT "sales_order_line_reversal_not_self" CHECK ("sales_order_lines"."reversal_of_sales_order_line_id" is null or "sales_order_lines"."reversal_of_sales_order_line_id" <> "sales_order_lines"."id"),
	CONSTRAINT "sales_order_line_supersedes_not_self" CHECK ("sales_order_lines"."supersedes_sales_order_line_id" is null or "sales_order_lines"."supersedes_sales_order_line_id" <> "sales_order_lines"."id")
);
--> statement-breakpoint
CREATE TABLE "sales_order_modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"parent_modifier_id" uuid,
	"line_number" integer NOT NULL,
	"external_id" text,
	"product_id" uuid,
	"recipe_version_id" uuid,
	"display_name" text NOT NULL,
	"quantity" numeric(20, 6) DEFAULT '1' NOT NULL,
	"unit_price_cents" integer DEFAULT 0 NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"is_removed" boolean DEFAULT false NOT NULL,
	"reversal_of_modifier_id" uuid,
	"supersedes_modifier_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_modifier_line_positive" CHECK ("sales_order_modifiers"."line_number" > 0),
	CONSTRAINT "sales_modifier_name_not_blank" CHECK (btrim("sales_order_modifiers"."display_name") <> ''),
	CONSTRAINT "sales_modifier_quantity_nonzero" CHECK ("sales_order_modifiers"."quantity" <> 0),
	CONSTRAINT "sales_modifier_amounts_reconcile" CHECK ("sales_order_modifiers"."total_cents" = "sales_order_modifiers"."subtotal_cents" - "sales_order_modifiers"."discount_cents" + "sales_order_modifiers"."tax_cents"),
	CONSTRAINT "sales_modifier_parent_not_self" CHECK ("sales_order_modifiers"."parent_modifier_id" is null or "sales_order_modifiers"."parent_modifier_id" <> "sales_order_modifiers"."id"),
	CONSTRAINT "sales_modifier_reversal_not_self" CHECK ("sales_order_modifiers"."reversal_of_modifier_id" is null or "sales_order_modifiers"."reversal_of_modifier_id" <> "sales_order_modifiers"."id"),
	CONSTRAINT "sales_modifier_supersedes_not_self" CHECK ("sales_order_modifiers"."supersedes_modifier_id" is null or "sales_order_modifiers"."supersedes_modifier_id" <> "sales_order_modifiers"."id")
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"source_system" varchar(96) NOT NULL,
	"external_id" text NOT NULL,
	"order_number" varchar(96),
	"business_date" date NOT NULL,
	"status" "sales_order_status" NOT NULL,
	"opened_at" timestamp (3) with time zone NOT NULL,
	"closed_at" timestamp (3) with time zone,
	"currency" varchar(3) NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"tip_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"guest_count" integer,
	"customer_reference" text,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reversal_of_sales_order_id" uuid,
	"supersedes_sales_order_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_order_source_not_blank" CHECK (btrim("sales_orders"."source_system") <> ''),
	CONSTRAINT "sales_order_times_ordered" CHECK ("sales_orders"."closed_at" is null or "sales_orders"."closed_at" >= "sales_orders"."opened_at"),
	CONSTRAINT "sales_order_currency_iso_code" CHECK ("sales_orders"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "sales_order_amounts_reconcile" CHECK ("sales_orders"."total_cents" = "sales_orders"."subtotal_cents" - "sales_orders"."discount_cents" + "sales_orders"."tax_cents" + "sales_orders"."tip_cents"),
	CONSTRAINT "sales_order_guest_count_nonnegative" CHECK ("sales_orders"."guest_count" is null or "sales_orders"."guest_count" >= 0),
	CONSTRAINT "sales_order_closed_state" CHECK ("sales_orders"."status" = 'open' or "sales_orders"."closed_at" is not null),
	CONSTRAINT "sales_order_reversal_not_self" CHECK ("sales_orders"."reversal_of_sales_order_id" is null or "sales_orders"."reversal_of_sales_order_id" <> "sales_orders"."id"),
	CONSTRAINT "sales_order_supersedes_not_self" CHECK ("sales_orders"."supersedes_sales_order_id" is null or "sales_orders"."supersedes_sales_order_id" <> "sales_orders"."id")
);
--> statement-breakpoint
CREATE TABLE "settlement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"settlement_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"line_type" "settlement_line_type" NOT NULL,
	"sales_order_id" uuid,
	"external_id" text,
	"source_transaction_id" text,
	"occurred_at" timestamp (3) with time zone,
	"description" text,
	"amount_cents" integer NOT NULL,
	"reversal_of_settlement_line_id" uuid,
	"supersedes_settlement_line_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_line_number_positive" CHECK ("settlement_lines"."line_number" > 0),
	CONSTRAINT "settlement_line_amount_nonzero" CHECK ("settlement_lines"."amount_cents" <> 0),
	CONSTRAINT "settlement_line_reversal_not_self" CHECK ("settlement_lines"."reversal_of_settlement_line_id" is null or "settlement_lines"."reversal_of_settlement_line_id" <> "settlement_lines"."id"),
	CONSTRAINT "settlement_line_supersedes_not_self" CHECK ("settlement_lines"."supersedes_settlement_line_id" is null or "settlement_lines"."supersedes_settlement_line_id" <> "settlement_lines"."id")
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"source_document_id" uuid,
	"source_system" varchar(96) NOT NULL,
	"external_id" text NOT NULL,
	"settlement_number" varchar(96),
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"period_starts_on" date,
	"period_ends_on" date,
	"initiated_at" timestamp (3) with time zone,
	"paid_at" timestamp (3) with time zone,
	"gross_cents" integer NOT NULL,
	"refund_cents" integer DEFAULT 0 NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"adjustment_cents" integer DEFAULT 0 NOT NULL,
	"net_cents" integer NOT NULL,
	"bank_reference" text,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reversal_of_settlement_id" uuid,
	"supersedes_settlement_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_source_not_blank" CHECK (btrim("settlements"."source_system") <> ''),
	CONSTRAINT "settlement_currency_iso_code" CHECK ("settlements"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "settlement_period_dates_ordered" CHECK ("settlements"."period_ends_on" is null or "settlements"."period_starts_on" is null or "settlements"."period_ends_on" >= "settlements"."period_starts_on"),
	CONSTRAINT "settlement_amounts_reconcile" CHECK ("settlements"."net_cents" = "settlements"."gross_cents" - "settlements"."refund_cents" - "settlements"."fee_cents" + "settlements"."adjustment_cents"),
	CONSTRAINT "settlement_paid_state" CHECK ("settlements"."status" not in ('paid', 'reversed') or "settlements"."paid_at" is not null),
	CONSTRAINT "settlement_reversal_not_self" CHECK ("settlements"."reversal_of_settlement_id" is null or "settlements"."reversal_of_settlement_id" <> "settlements"."id"),
	CONSTRAINT "settlement_supersedes_not_self" CHECK ("settlements"."supersedes_settlement_id" is null or "settlements"."supersedes_settlement_id" <> "settlements"."id")
);
--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_closed_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("closed_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_account_id_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_staff_member_id_staff_members_id_fk" FOREIGN KEY ("actor_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_previous_audit_event_id_audit_events_id_fk" FOREIGN KEY ("previous_audit_event_id") REFERENCES "public"."audit_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_accounts" ADD CONSTRAINT "card_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_accounts" ADD CONSTRAINT "card_accounts_ledger_account_id_accounts_id_fk" FOREIGN KEY ("ledger_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transaction_matches" ADD CONSTRAINT "card_transaction_matches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transaction_matches" ADD CONSTRAINT "card_transaction_matches_card_transaction_id_card_transactions_id_fk" FOREIGN KEY ("card_transaction_id") REFERENCES "public"."card_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transaction_matches" ADD CONSTRAINT "card_transaction_matches_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transaction_matches" ADD CONSTRAINT "card_transaction_matches_matched_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("matched_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transaction_matches" ADD CONSTRAINT "card_transaction_matches_supersedes_match_id_card_transaction_matches_id_fk" FOREIGN KEY ("supersedes_match_id") REFERENCES "public"."card_transaction_matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transaction_matches" ADD CONSTRAINT "card_transaction_matches_reversal_of_match_id_card_transaction_matches_id_fk" FOREIGN KEY ("reversal_of_match_id") REFERENCES "public"."card_transaction_matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_card_account_id_card_accounts_id_fk" FOREIGN KEY ("card_account_id") REFERENCES "public"."card_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_reversal_of_card_transaction_id_card_transactions_id_fk" FOREIGN KEY ("reversal_of_card_transaction_id") REFERENCES "public"."card_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_supersedes_card_transaction_id_card_transactions_id_fk" FOREIGN KEY ("supersedes_card_transaction_id") REFERENCES "public"."card_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_inventory_uom_id_units_of_measure_id_fk" FOREIGN KEY ("inventory_uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_packs" ADD CONSTRAINT "purchase_packs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_packs" ADD CONSTRAINT "purchase_packs_vendor_item_id_vendor_items_id_fk" FOREIGN KEY ("vendor_item_id") REFERENCES "public"."vendor_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_packs" ADD CONSTRAINT "purchase_packs_pack_uom_id_units_of_measure_id_fk" FOREIGN KEY ("pack_uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_packs" ADD CONSTRAINT "purchase_packs_contained_uom_id_units_of_measure_id_fk" FOREIGN KEY ("contained_uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_packs" ADD CONSTRAINT "purchase_packs_supersedes_purchase_pack_id_purchase_packs_id_fk" FOREIGN KEY ("supersedes_purchase_pack_id") REFERENCES "public"."purchase_packs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uom_conversions" ADD CONSTRAINT "uom_conversions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uom_conversions" ADD CONSTRAINT "uom_conversions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uom_conversions" ADD CONSTRAINT "uom_conversions_from_uom_id_units_of_measure_id_fk" FOREIGN KEY ("from_uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uom_conversions" ADD CONSTRAINT "uom_conversions_to_uom_id_units_of_measure_id_fk" FOREIGN KEY ("to_uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uom_conversions" ADD CONSTRAINT "uom_conversions_supersedes_conversion_id_uom_conversions_id_fk" FOREIGN KEY ("supersedes_conversion_id") REFERENCES "public"."uom_conversions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_items" ADD CONSTRAINT "vendor_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_items" ADD CONSTRAINT "vendor_items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_items" ADD CONSTRAINT "vendor_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_items" ADD CONSTRAINT "vendor_items_purchase_uom_id_units_of_measure_id_fk" FOREIGN KEY ("purchase_uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_staff_role_id_staff_roles_id_fk" FOREIGN KEY ("staff_role_id") REFERENCES "public"."staff_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_assigned_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("assigned_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_extraction_run_id_extraction_runs_id_fk" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_supersedes_run_id_extraction_runs_id_fk" FOREIGN KEY ("supersedes_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_revisions" ADD CONSTRAINT "mapping_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_revisions" ADD CONSTRAINT "mapping_revisions_document_line_id_document_lines_id_fk" FOREIGN KEY ("document_line_id") REFERENCES "public"."document_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_revisions" ADD CONSTRAINT "mapping_revisions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_revisions" ADD CONSTRAINT "mapping_revisions_vendor_item_id_vendor_items_id_fk" FOREIGN KEY ("vendor_item_id") REFERENCES "public"."vendor_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_revisions" ADD CONSTRAINT "mapping_revisions_purchase_pack_id_purchase_packs_id_fk" FOREIGN KEY ("purchase_pack_id") REFERENCES "public"."purchase_packs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_revisions" ADD CONSTRAINT "mapping_revisions_mapped_uom_id_units_of_measure_id_fk" FOREIGN KEY ("mapped_uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_revisions" ADD CONSTRAINT "mapping_revisions_created_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("created_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_revisions" ADD CONSTRAINT "mapping_revisions_supersedes_mapping_revision_id_mapping_revisions_id_fk" FOREIGN KEY ("supersedes_mapping_revision_id") REFERENCES "public"."mapping_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_supersedes_document_id_source_documents_id_fk" FOREIGN KEY ("supersedes_document_id") REFERENCES "public"."source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_causation_event_id_integration_events_id_fk" FOREIGN KEY ("causation_event_id") REFERENCES "public"."integration_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_supersedes_event_id_integration_events_id_fk" FOREIGN KEY ("supersedes_event_id") REFERENCES "public"."integration_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_count_session_id_inventory_count_sessions_id_fk" FOREIGN KEY ("count_session_id") REFERENCES "public"."inventory_count_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_counted_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("counted_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_created_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("created_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_approved_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("approved_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_supersedes_count_session_id_inventory_count_sessions_id_fk" FOREIGN KEY ("supersedes_count_session_id") REFERENCES "public"."inventory_count_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_goods_receipt_line_id_goods_receipt_lines_id_fk" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "public"."goods_receipt_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_purchase_line_id_purchase_lines_id_fk" FOREIGN KEY ("purchase_line_id") REFERENCES "public"."purchase_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sales_order_line_id_sales_order_lines_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_count_line_id_inventory_count_lines_id_fk" FOREIGN KEY ("inventory_count_line_id") REFERENCES "public"."inventory_count_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_counterpart_movement_id_inventory_movements_id_fk" FOREIGN KEY ("counterpart_movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reversal_of_movement_id_inventory_movements_id_fk" FOREIGN KEY ("reversal_of_movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_supersedes_movement_id_inventory_movements_id_fk" FOREIGN KEY ("supersedes_movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("created_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_batches" ADD CONSTRAINT "journal_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_batches" ADD CONSTRAINT "journal_batches_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_batches" ADD CONSTRAINT "journal_batches_posted_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("posted_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_batches" ADD CONSTRAINT "journal_batches_reversal_of_journal_batch_id_journal_batches_id_fk" FOREIGN KEY ("reversal_of_journal_batch_id") REFERENCES "public"."journal_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_batches" ADD CONSTRAINT "journal_batches_supersedes_journal_batch_id_journal_batches_id_fk" FOREIGN KEY ("supersedes_journal_batch_id") REFERENCES "public"."journal_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_batch_id_journal_batches_id_fk" FOREIGN KEY ("journal_batch_id") REFERENCES "public"."journal_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_purchase_line_id_purchase_lines_id_fk" FOREIGN KEY ("purchase_line_id") REFERENCES "public"."purchase_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_card_transaction_id_card_transactions_id_fk" FOREIGN KEY ("card_transaction_id") REFERENCES "public"."card_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_inventory_movement_id_inventory_movements_id_fk" FOREIGN KEY ("inventory_movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_sales_order_line_id_sales_order_lines_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_settlement_line_id_settlement_lines_id_fk" FOREIGN KEY ("settlement_line_id") REFERENCES "public"."settlement_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_reversal_of_journal_line_id_journal_lines_id_fk" FOREIGN KEY ("reversal_of_journal_line_id") REFERENCES "public"."journal_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_purchase_line_id_purchase_lines_id_fk" FOREIGN KEY ("purchase_line_id") REFERENCES "public"."purchase_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("received_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_reversal_of_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("reversal_of_goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supersedes_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("supersedes_goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_vendor_item_id_vendor_items_id_fk" FOREIGN KEY ("vendor_item_id") REFERENCES "public"."vendor_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_purchase_pack_id_purchase_packs_id_fk" FOREIGN KEY ("purchase_pack_id") REFERENCES "public"."purchase_packs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_source_document_line_id_document_lines_id_fk" FOREIGN KEY ("source_document_line_id") REFERENCES "public"."document_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_mapping_revision_id_mapping_revisions_id_fk" FOREIGN KEY ("mapping_revision_id") REFERENCES "public"."mapping_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("created_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_approved_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("approved_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_reversal_of_purchase_id_purchases_id_fk" FOREIGN KEY ("reversal_of_purchase_id") REFERENCES "public"."purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supersedes_purchase_id_purchases_id_fk" FOREIGN KEY ("supersedes_purchase_id") REFERENCES "public"."purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_nested_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("nested_recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_yield_uom_id_units_of_measure_id_fk" FOREIGN KEY ("yield_uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_created_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("created_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_approved_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("approved_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_supersedes_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("supersedes_recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_output_product_id_products_id_fk" FOREIGN KEY ("output_product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_reversal_of_sales_order_line_id_sales_order_lines_id_fk" FOREIGN KEY ("reversal_of_sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_supersedes_sales_order_line_id_sales_order_lines_id_fk" FOREIGN KEY ("supersedes_sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_modifiers" ADD CONSTRAINT "sales_order_modifiers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_modifiers" ADD CONSTRAINT "sales_order_modifiers_sales_order_line_id_sales_order_lines_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_modifiers" ADD CONSTRAINT "sales_order_modifiers_parent_modifier_id_sales_order_modifiers_id_fk" FOREIGN KEY ("parent_modifier_id") REFERENCES "public"."sales_order_modifiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_modifiers" ADD CONSTRAINT "sales_order_modifiers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_modifiers" ADD CONSTRAINT "sales_order_modifiers_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_modifiers" ADD CONSTRAINT "sales_order_modifiers_reversal_of_modifier_id_sales_order_modifiers_id_fk" FOREIGN KEY ("reversal_of_modifier_id") REFERENCES "public"."sales_order_modifiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_modifiers" ADD CONSTRAINT "sales_order_modifiers_supersedes_modifier_id_sales_order_modifiers_id_fk" FOREIGN KEY ("supersedes_modifier_id") REFERENCES "public"."sales_order_modifiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_reversal_of_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("reversal_of_sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_supersedes_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("supersedes_sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_reversal_of_settlement_line_id_settlement_lines_id_fk" FOREIGN KEY ("reversal_of_settlement_line_id") REFERENCES "public"."settlement_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_supersedes_settlement_line_id_settlement_lines_id_fk" FOREIGN KEY ("supersedes_settlement_line_id") REFERENCES "public"."settlement_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_reversal_of_settlement_id_settlements_id_fk" FOREIGN KEY ("reversal_of_settlement_id") REFERENCES "public"."settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_supersedes_settlement_id_settlements_id_fk" FOREIGN KEY ("supersedes_settlement_id") REFERENCES "public"."settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_period_year_number_uidx" ON "accounting_periods" USING btree ("organization_id","fiscal_year","period_number");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_period_dates_uidx" ON "accounting_periods" USING btree ("organization_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "accounting_period_org_status_idx" ON "accounting_periods" USING btree ("organization_id","status","starts_on");--> statement-breakpoint
CREATE UNIQUE INDEX "account_org_code_uidx" ON "accounts" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "account_org_external_uidx" ON "accounts" USING btree ("organization_id","external_id") WHERE "accounts"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "account_org_type_active_idx" ON "accounts" USING btree ("organization_id","account_type","is_active");--> statement-breakpoint
CREATE INDEX "account_parent_idx" ON "accounts" USING btree ("parent_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_event_sequence_uidx" ON "audit_events" USING btree ("sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_event_org_hash_uidx" ON "audit_events" USING btree ("organization_id","event_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_event_previous_uidx" ON "audit_events" USING btree ("previous_audit_event_id") WHERE "audit_events"."previous_audit_event_id" is not null;--> statement-breakpoint
CREATE INDEX "audit_event_org_time_idx" ON "audit_events" USING btree ("organization_id","occurred_at","sequence");--> statement-breakpoint
CREATE INDEX "audit_event_entity_idx" ON "audit_events" USING btree ("organization_id","entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_event_actor_idx" ON "audit_events" USING btree ("actor_staff_member_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_event_request_idx" ON "audit_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "audit_event_correlation_idx" ON "audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "card_account_source_external_uidx" ON "card_accounts" USING btree ("organization_id","source_system","external_id");--> statement-breakpoint
CREATE INDEX "card_account_org_idx" ON "card_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "card_account_ledger_idx" ON "card_accounts" USING btree ("ledger_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "card_match_tx_purchase_revision_uidx" ON "card_transaction_matches" USING btree ("card_transaction_id","purchase_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "card_match_supersedes_uidx" ON "card_transaction_matches" USING btree ("supersedes_match_id") WHERE "card_transaction_matches"."supersedes_match_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "card_match_reversal_of_uidx" ON "card_transaction_matches" USING btree ("reversal_of_match_id") WHERE "card_transaction_matches"."reversal_of_match_id" is not null;--> statement-breakpoint
CREATE INDEX "card_match_tx_status_idx" ON "card_transaction_matches" USING btree ("card_transaction_id","status");--> statement-breakpoint
CREATE INDEX "card_match_purchase_status_idx" ON "card_transaction_matches" USING btree ("purchase_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "card_tx_source_external_uidx" ON "card_transactions" USING btree ("card_account_id","source_system","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "card_tx_reversal_of_uidx" ON "card_transactions" USING btree ("reversal_of_card_transaction_id") WHERE "card_transactions"."reversal_of_card_transaction_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "card_tx_supersedes_uidx" ON "card_transactions" USING btree ("supersedes_card_transaction_id") WHERE "card_transactions"."supersedes_card_transaction_id" is not null;--> statement-breakpoint
CREATE INDEX "card_tx_org_posted_idx" ON "card_transactions" USING btree ("organization_id","posted_on");--> statement-breakpoint
CREATE INDEX "card_tx_account_status_idx" ON "card_transactions" USING btree ("card_account_id","status","posted_on");--> statement-breakpoint
CREATE INDEX "card_tx_merchant_idx" ON "card_transactions" USING btree ("organization_id","normalized_merchant_name");--> statement-breakpoint
CREATE UNIQUE INDEX "product_org_sku_uidx" ON "products" USING btree ("organization_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "product_org_barcode_uidx" ON "products" USING btree ("organization_id","barcode") WHERE "products"."barcode" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_org_external_uidx" ON "products" USING btree ("organization_id","external_id") WHERE "products"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "product_org_active_type_idx" ON "products" USING btree ("organization_id","is_active","product_type");--> statement-breakpoint
CREATE INDEX "product_inventory_uom_idx" ON "products" USING btree ("inventory_uom_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_pack_item_code_uidx" ON "purchase_packs" USING btree ("vendor_item_id","code","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_pack_item_external_uidx" ON "purchase_packs" USING btree ("vendor_item_id","external_id") WHERE "purchase_packs"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_pack_supersedes_uidx" ON "purchase_packs" USING btree ("supersedes_purchase_pack_id") WHERE "purchase_packs"."supersedes_purchase_pack_id" is not null;--> statement-breakpoint
CREATE INDEX "purchase_pack_item_active_idx" ON "purchase_packs" USING btree ("vendor_item_id","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "uom_org_code_uidx" ON "units_of_measure" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uom_org_external_uidx" ON "units_of_measure" USING btree ("organization_id","external_id") WHERE "units_of_measure"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uom_org_dimension_base_uidx" ON "units_of_measure" USING btree ("organization_id","dimension") WHERE "units_of_measure"."is_dimension_base";--> statement-breakpoint
CREATE UNIQUE INDEX "uom_conversion_generic_uidx" ON "uom_conversions" USING btree ("organization_id","from_uom_id","to_uom_id","effective_from") WHERE "uom_conversions"."product_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uom_conversion_product_uidx" ON "uom_conversions" USING btree ("organization_id","product_id","from_uom_id","to_uom_id","effective_from") WHERE "uom_conversions"."product_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uom_conversion_supersedes_uidx" ON "uom_conversions" USING btree ("supersedes_conversion_id") WHERE "uom_conversions"."supersedes_conversion_id" is not null;--> statement-breakpoint
CREATE INDEX "uom_conversion_lookup_idx" ON "uom_conversions" USING btree ("organization_id","product_id","from_uom_id","to_uom_id","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_item_vendor_sku_uidx" ON "vendor_items" USING btree ("vendor_id","vendor_sku");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_item_vendor_external_uidx" ON "vendor_items" USING btree ("vendor_id","external_id") WHERE "vendor_items"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "vendor_item_org_product_idx" ON "vendor_items" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "vendor_item_vendor_active_idx" ON "vendor_items" USING btree ("vendor_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_org_code_uidx" ON "vendors" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_org_external_uidx" ON "vendors" USING btree ("organization_id","external_id") WHERE "vendors"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "vendor_org_status_idx" ON "vendors" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "location_org_code_uidx" ON "locations" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "location_org_external_uidx" ON "locations" USING btree ("organization_id","external_id") WHERE "locations"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "location_org_active_idx" ON "locations" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "org_slug_uidx" ON "organizations" USING btree (lower("slug"));--> statement-breakpoint
CREATE UNIQUE INDEX "org_external_id_uidx" ON "organizations" USING btree ("external_id") WHERE "organizations"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_auth_user_uidx" ON "staff_members" USING btree ("auth_user_id") WHERE "staff_members"."auth_user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_org_email_uidx" ON "staff_members" USING btree ("organization_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "staff_org_employee_uidx" ON "staff_members" USING btree ("organization_id","employee_number") WHERE "staff_members"."employee_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_org_external_uidx" ON "staff_members" USING btree ("organization_id","external_id") WHERE "staff_members"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_org_status_idx" ON "staff_members" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assign_org_wide_uidx" ON "staff_role_assignments" USING btree ("staff_member_id","staff_role_id","effective_from") WHERE "staff_role_assignments"."location_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "role_assign_location_uidx" ON "staff_role_assignments" USING btree ("staff_member_id","staff_role_id","location_id","effective_from") WHERE "staff_role_assignments"."location_id" is not null;--> statement-breakpoint
CREATE INDEX "role_assign_org_active_idx" ON "staff_role_assignments" USING btree ("organization_id","staff_member_id","effective_to");--> statement-breakpoint
CREATE INDEX "role_assign_location_idx" ON "staff_role_assignments" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_role_org_key_uidx" ON "staff_roles" USING btree ("organization_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "document_line_run_number_uidx" ON "document_lines" USING btree ("extraction_run_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "document_line_run_source_uidx" ON "document_lines" USING btree ("extraction_run_id","source_line_id") WHERE "document_lines"."source_line_id" is not null;--> statement-breakpoint
CREATE INDEX "document_line_document_idx" ON "document_lines" USING btree ("source_document_id","line_number");--> statement-breakpoint
CREATE INDEX "document_line_org_vendor_sku_idx" ON "document_lines" USING btree ("organization_id","vendor_sku");--> statement-breakpoint
CREATE UNIQUE INDEX "extraction_run_doc_number_uidx" ON "extraction_runs" USING btree ("source_document_id","run_number");--> statement-breakpoint
CREATE UNIQUE INDEX "extraction_run_supersedes_uidx" ON "extraction_runs" USING btree ("supersedes_run_id") WHERE "extraction_runs"."supersedes_run_id" is not null;--> statement-breakpoint
CREATE INDEX "extraction_run_org_status_idx" ON "extraction_runs" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "extraction_run_doc_finished_idx" ON "extraction_runs" USING btree ("source_document_id","finished_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mapping_revision_line_number_uidx" ON "mapping_revisions" USING btree ("document_line_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "mapping_revision_supersedes_uidx" ON "mapping_revisions" USING btree ("supersedes_mapping_revision_id") WHERE "mapping_revisions"."supersedes_mapping_revision_id" is not null;--> statement-breakpoint
CREATE INDEX "mapping_revision_line_created_idx" ON "mapping_revisions" USING btree ("document_line_id","created_at");--> statement-breakpoint
CREATE INDEX "mapping_revision_product_idx" ON "mapping_revisions" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_doc_org_storage_uidx" ON "source_documents" USING btree ("organization_id","storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "source_doc_org_hash_uidx" ON "source_documents" USING btree ("organization_id","sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "source_doc_source_external_uidx" ON "source_documents" USING btree ("organization_id","source_system","external_id") WHERE "source_documents"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "source_doc_supersedes_uidx" ON "source_documents" USING btree ("supersedes_document_id") WHERE "source_documents"."supersedes_document_id" is not null;--> statement-breakpoint
CREATE INDEX "source_doc_org_status_received_idx" ON "source_documents" USING btree ("organization_id","status","received_at");--> statement-breakpoint
CREATE INDEX "source_doc_vendor_date_idx" ON "source_documents" USING btree ("vendor_id","document_date");--> statement-breakpoint
CREATE INDEX "source_doc_location_date_idx" ON "source_documents" USING btree ("location_id","document_date");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_event_idempotency_uidx" ON "integration_events" USING btree ("organization_id","source_system","direction","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_event_external_uidx" ON "integration_events" USING btree ("organization_id","source_system","direction","external_event_id") WHERE "integration_events"."external_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_event_supersedes_uidx" ON "integration_events" USING btree ("supersedes_event_id") WHERE "integration_events"."supersedes_event_id" is not null;--> statement-breakpoint
CREATE INDEX "integration_event_work_queue_idx" ON "integration_events" USING btree ("status","next_attempt_at","received_at");--> statement-breakpoint
CREATE INDEX "integration_event_aggregate_idx" ON "integration_events" USING btree ("organization_id","aggregate_type","aggregate_id","aggregate_version");--> statement-breakpoint
CREATE INDEX "integration_event_correlation_idx" ON "integration_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_count_line_number_uidx" ON "inventory_count_lines" USING btree ("count_session_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_count_line_product_uidx" ON "inventory_count_lines" USING btree ("count_session_id","product_id","uom_id") WHERE "inventory_count_lines"."lot_code" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_count_line_lot_uidx" ON "inventory_count_lines" USING btree ("count_session_id","product_id","uom_id","lot_code") WHERE "inventory_count_lines"."lot_code" is not null;--> statement-breakpoint
CREATE INDEX "inventory_count_line_org_product_idx" ON "inventory_count_lines" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_count_org_number_uidx" ON "inventory_count_sessions" USING btree ("organization_id","count_number");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_count_source_external_uidx" ON "inventory_count_sessions" USING btree ("organization_id","source_system","external_id") WHERE "inventory_count_sessions"."source_system" is not null and "inventory_count_sessions"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_count_supersedes_uidx" ON "inventory_count_sessions" USING btree ("supersedes_count_session_id") WHERE "inventory_count_sessions"."supersedes_count_session_id" is not null;--> statement-breakpoint
CREATE INDEX "inventory_count_location_status_idx" ON "inventory_count_sessions" USING btree ("location_id","status","as_of");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movement_source_external_uidx" ON "inventory_movements" USING btree ("organization_id","source_system","external_id") WHERE "inventory_movements"."source_system" is not null and "inventory_movements"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movement_reversal_uidx" ON "inventory_movements" USING btree ("reversal_of_movement_id") WHERE "inventory_movements"."reversal_of_movement_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movement_supersedes_uidx" ON "inventory_movements" USING btree ("supersedes_movement_id") WHERE "inventory_movements"."supersedes_movement_id" is not null;--> statement-breakpoint
CREATE INDEX "inventory_movement_balance_idx" ON "inventory_movements" USING btree ("location_id","product_id","business_date","occurred_at");--> statement-breakpoint
CREATE INDEX "inventory_movement_org_product_idx" ON "inventory_movements" USING btree ("organization_id","product_id","occurred_at");--> statement-breakpoint
CREATE INDEX "inventory_movement_group_idx" ON "inventory_movements" USING btree ("movement_group_id");--> statement-breakpoint
CREATE INDEX "inventory_movement_receipt_line_idx" ON "inventory_movements" USING btree ("goods_receipt_line_id");--> statement-breakpoint
CREATE INDEX "inventory_movement_sales_line_idx" ON "inventory_movements" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "inventory_movement_count_line_idx" ON "inventory_movements" USING btree ("inventory_count_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_batch_org_number_uidx" ON "journal_batches" USING btree ("organization_id","batch_number");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_batch_source_external_uidx" ON "journal_batches" USING btree ("organization_id","source_system","external_id") WHERE "journal_batches"."source_system" is not null and "journal_batches"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "journal_batch_reversal_uidx" ON "journal_batches" USING btree ("reversal_of_journal_batch_id") WHERE "journal_batches"."reversal_of_journal_batch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "journal_batch_supersedes_uidx" ON "journal_batches" USING btree ("supersedes_journal_batch_id") WHERE "journal_batches"."supersedes_journal_batch_id" is not null;--> statement-breakpoint
CREATE INDEX "journal_batch_period_status_idx" ON "journal_batches" USING btree ("accounting_period_id","status","journal_date");--> statement-breakpoint
CREATE INDEX "journal_batch_source_idx" ON "journal_batches" USING btree ("organization_id","source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_batch_number_uidx" ON "journal_lines" USING btree ("journal_batch_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_batch_external_uidx" ON "journal_lines" USING btree ("journal_batch_id","external_id") WHERE "journal_lines"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_reversal_uidx" ON "journal_lines" USING btree ("reversal_of_journal_line_id") WHERE "journal_lines"."reversal_of_journal_line_id" is not null;--> statement-breakpoint
CREATE INDEX "journal_line_account_batch_idx" ON "journal_lines" USING btree ("account_id","journal_batch_id");--> statement-breakpoint
CREATE INDEX "journal_line_location_idx" ON "journal_lines" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "journal_line_purchase_idx" ON "journal_lines" USING btree ("purchase_line_id");--> statement-breakpoint
CREATE INDEX "journal_line_card_idx" ON "journal_lines" USING btree ("card_transaction_id");--> statement-breakpoint
CREATE INDEX "journal_line_inventory_idx" ON "journal_lines" USING btree ("inventory_movement_id");--> statement-breakpoint
CREATE INDEX "journal_line_sales_idx" ON "journal_lines" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "journal_line_settlement_idx" ON "journal_lines" USING btree ("settlement_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_line_number_uidx" ON "goods_receipt_lines" USING btree ("goods_receipt_id","line_number");--> statement-breakpoint
CREATE INDEX "goods_receipt_line_purchase_line_idx" ON "goods_receipt_lines" USING btree ("purchase_line_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_line_org_product_idx" ON "goods_receipt_lines" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_line_lot_idx" ON "goods_receipt_lines" USING btree ("product_id","lot_code");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_org_number_uidx" ON "goods_receipts" USING btree ("organization_id","receipt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_source_external_uidx" ON "goods_receipts" USING btree ("organization_id","source_system","external_id") WHERE "goods_receipts"."source_system" is not null and "goods_receipts"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_reversal_of_uidx" ON "goods_receipts" USING btree ("reversal_of_goods_receipt_id") WHERE "goods_receipts"."reversal_of_goods_receipt_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_supersedes_uidx" ON "goods_receipts" USING btree ("supersedes_goods_receipt_id") WHERE "goods_receipts"."supersedes_goods_receipt_id" is not null;--> statement-breakpoint
CREATE INDEX "goods_receipt_purchase_idx" ON "goods_receipts" USING btree ("purchase_id","received_at");--> statement-breakpoint
CREATE INDEX "goods_receipt_location_date_idx" ON "goods_receipts" USING btree ("location_id","received_at");--> statement-breakpoint
CREATE INDEX "goods_receipt_org_status_idx" ON "goods_receipts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_line_number_uidx" ON "purchase_lines" USING btree ("purchase_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_line_document_line_uidx" ON "purchase_lines" USING btree ("source_document_line_id") WHERE "purchase_lines"."source_document_line_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_line_mapping_revision_uidx" ON "purchase_lines" USING btree ("mapping_revision_id") WHERE "purchase_lines"."mapping_revision_id" is not null;--> statement-breakpoint
CREATE INDEX "purchase_line_org_product_idx" ON "purchase_lines" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "purchase_line_vendor_item_idx" ON "purchase_lines" USING btree ("vendor_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_org_number_uidx" ON "purchases" USING btree ("organization_id","purchase_number");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_source_external_uidx" ON "purchases" USING btree ("organization_id","source_system","external_id") WHERE "purchases"."source_system" is not null and "purchases"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_source_document_uidx" ON "purchases" USING btree ("source_document_id") WHERE "purchases"."source_document_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_reversal_of_uidx" ON "purchases" USING btree ("reversal_of_purchase_id") WHERE "purchases"."reversal_of_purchase_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_supersedes_uidx" ON "purchases" USING btree ("supersedes_purchase_id") WHERE "purchases"."supersedes_purchase_id" is not null;--> statement-breakpoint
CREATE INDEX "purchase_org_status_date_idx" ON "purchases" USING btree ("organization_id","status","purchase_date");--> statement-breakpoint
CREATE INDEX "purchase_vendor_date_idx" ON "purchases" USING btree ("vendor_id","purchase_date");--> statement-breakpoint
CREATE INDEX "purchase_location_date_idx" ON "purchases" USING btree ("location_id","purchase_date");--> statement-breakpoint
CREATE INDEX "purchase_period_idx" ON "purchases" USING btree ("accounting_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_component_line_uidx" ON "recipe_components" USING btree ("recipe_version_id","line_number");--> statement-breakpoint
CREATE INDEX "recipe_component_product_idx" ON "recipe_components" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "recipe_component_nested_idx" ON "recipe_components" USING btree ("nested_recipe_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_version_number_uidx" ON "recipe_versions" USING btree ("recipe_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_version_supersedes_uidx" ON "recipe_versions" USING btree ("supersedes_recipe_version_id") WHERE "recipe_versions"."supersedes_recipe_version_id" is not null;--> statement-breakpoint
CREATE INDEX "recipe_version_effective_idx" ON "recipe_versions" USING btree ("recipe_id","status","effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_org_code_uidx" ON "recipes" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_source_external_uidx" ON "recipes" USING btree ("organization_id","source_system","external_id") WHERE "recipes"."source_system" is not null and "recipes"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "recipe_org_output_idx" ON "recipes" USING btree ("organization_id","output_product_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_order_line_number_uidx" ON "sales_order_lines" USING btree ("sales_order_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_order_line_external_uidx" ON "sales_order_lines" USING btree ("sales_order_id","external_id") WHERE "sales_order_lines"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_order_line_reversal_uidx" ON "sales_order_lines" USING btree ("reversal_of_sales_order_line_id") WHERE "sales_order_lines"."reversal_of_sales_order_line_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_order_line_supersedes_uidx" ON "sales_order_lines" USING btree ("supersedes_sales_order_line_id") WHERE "sales_order_lines"."supersedes_sales_order_line_id" is not null;--> statement-breakpoint
CREATE INDEX "sales_order_line_org_product_idx" ON "sales_order_lines" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "sales_order_line_recipe_idx" ON "sales_order_lines" USING btree ("recipe_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_modifier_line_number_uidx" ON "sales_order_modifiers" USING btree ("sales_order_line_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_modifier_external_uidx" ON "sales_order_modifiers" USING btree ("sales_order_line_id","external_id") WHERE "sales_order_modifiers"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_modifier_reversal_uidx" ON "sales_order_modifiers" USING btree ("reversal_of_modifier_id") WHERE "sales_order_modifiers"."reversal_of_modifier_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_modifier_supersedes_uidx" ON "sales_order_modifiers" USING btree ("supersedes_modifier_id") WHERE "sales_order_modifiers"."supersedes_modifier_id" is not null;--> statement-breakpoint
CREATE INDEX "sales_modifier_product_idx" ON "sales_order_modifiers" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "sales_modifier_recipe_idx" ON "sales_order_modifiers" USING btree ("recipe_version_id");--> statement-breakpoint
CREATE INDEX "sales_modifier_parent_idx" ON "sales_order_modifiers" USING btree ("parent_modifier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_order_source_external_uidx" ON "sales_orders" USING btree ("location_id","source_system","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_order_reversal_of_uidx" ON "sales_orders" USING btree ("reversal_of_sales_order_id") WHERE "sales_orders"."reversal_of_sales_order_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_order_supersedes_uidx" ON "sales_orders" USING btree ("supersedes_sales_order_id") WHERE "sales_orders"."supersedes_sales_order_id" is not null;--> statement-breakpoint
CREATE INDEX "sales_order_org_business_date_idx" ON "sales_orders" USING btree ("organization_id","business_date");--> statement-breakpoint
CREATE INDEX "sales_order_location_status_idx" ON "sales_orders" USING btree ("location_id","status","business_date");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_line_number_uidx" ON "settlement_lines" USING btree ("settlement_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_line_external_uidx" ON "settlement_lines" USING btree ("settlement_id","external_id") WHERE "settlement_lines"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_line_reversal_uidx" ON "settlement_lines" USING btree ("reversal_of_settlement_line_id") WHERE "settlement_lines"."reversal_of_settlement_line_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_line_supersedes_uidx" ON "settlement_lines" USING btree ("supersedes_settlement_line_id") WHERE "settlement_lines"."supersedes_settlement_line_id" is not null;--> statement-breakpoint
CREATE INDEX "settlement_line_sales_order_idx" ON "settlement_lines" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "settlement_line_source_tx_idx" ON "settlement_lines" USING btree ("organization_id","source_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_source_external_uidx" ON "settlements" USING btree ("organization_id","source_system","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_reversal_of_uidx" ON "settlements" USING btree ("reversal_of_settlement_id") WHERE "settlements"."reversal_of_settlement_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_supersedes_uidx" ON "settlements" USING btree ("supersedes_settlement_id") WHERE "settlements"."supersedes_settlement_id" is not null;--> statement-breakpoint
CREATE INDEX "settlement_org_status_paid_idx" ON "settlements" USING btree ("organization_id","status","paid_at");--> statement-breakpoint
CREATE INDEX "settlement_location_period_idx" ON "settlements" USING btree ("location_id","period_starts_on","period_ends_on");