CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"source_system" varchar(96) NOT NULL,
	"external_account_id" text NOT NULL,
	"display_name" text NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"credential_reference" text,
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_connection_source_not_blank" CHECK (btrim("integration_connections"."source_system") <> ''),
	CONSTRAINT "integration_connection_external_not_blank" CHECK (btrim("integration_connections"."external_account_id") <> ''),
	CONSTRAINT "integration_connection_name_not_blank" CHECK (btrim("integration_connections"."display_name") <> ''),
	CONSTRAINT "integration_connection_status_allowed" CHECK ("integration_connections"."status" in ('active', 'paused', 'error', 'disconnected'))
);
--> statement-breakpoint
CREATE TABLE "daily_sales_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"source_system" varchar(96) NOT NULL,
	"business_date" date NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(32) DEFAULT 'provisional' NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"payment_count" integer DEFAULT 0 NOT NULL,
	"refund_count" integer DEFAULT 0 NOT NULL,
	"gross_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"tip_cents" integer DEFAULT 0 NOT NULL,
	"refund_cents" integer DEFAULT 0 NOT NULL,
	"net_collected_cents" integer DEFAULT 0 NOT NULL,
	"controls" jsonb NOT NULL,
	"reconciled_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_sales_control_status_allowed" CHECK ("daily_sales_controls"."status" in ('provisional', 'verified', 'exception')),
	CONSTRAINT "daily_sales_control_currency_iso" CHECK ("daily_sales_controls"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "daily_sales_control_counts_nonnegative" CHECK ("daily_sales_controls"."order_count" >= 0 and "daily_sales_controls"."payment_count" >= 0 and "daily_sales_controls"."refund_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_order_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"primary_sales_order_id" uuid NOT NULL,
	"linked_sales_order_id" uuid NOT NULL,
	"relationship" varchar(64) DEFAULT 'same_sale' NOT NULL,
	"match_method" varchar(64) NOT NULL,
	"confidence" numeric(7, 6),
	"status" varchar(32) DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_order_link_distinct_orders" CHECK ("sales_order_links"."primary_sales_order_id" <> "sales_order_links"."linked_sales_order_id"),
	CONSTRAINT "sales_order_link_status_allowed" CHECK ("sales_order_links"."status" in ('proposed', 'confirmed', 'rejected', 'reversed')),
	CONSTRAINT "sales_order_link_confidence_range" CHECK ("sales_order_links"."confidence" is null or ("sales_order_links"."confidence" >= 0 and "sales_order_links"."confidence" <= 1))
);
--> statement-breakpoint
CREATE TABLE "sales_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"sales_order_id" uuid,
	"source_system" varchar(96) NOT NULL,
	"external_id" text NOT NULL,
	"business_date" date NOT NULL,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"status" varchar(64) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_cents" integer NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"tip_cents" integer DEFAULT 0 NOT NULL,
	"total_collected_cents" integer NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"net_collected_cents" integer NOT NULL,
	"tender_external_id" text,
	"tender_type" varchar(64) NOT NULL,
	"tender_label" text NOT NULL,
	"source_channel" varchar(64) NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_payment_source_not_blank" CHECK (btrim("sales_payments"."source_system") <> ''),
	CONSTRAINT "sales_payment_currency_iso_code" CHECK ("sales_payments"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "sales_payment_amounts_reconcile" CHECK ("sales_payments"."total_collected_cents" = "sales_payments"."amount_cents" + "sales_payments"."tip_cents" and "sales_payments"."net_collected_cents" = "sales_payments"."total_collected_cents" - "sales_payments"."refunded_cents")
);
--> statement-breakpoint
CREATE TABLE "sales_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"sales_order_id" uuid,
	"sales_payment_id" uuid,
	"source_system" varchar(96) NOT NULL,
	"external_id" text NOT NULL,
	"business_date" date NOT NULL,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_cents" integer NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"tip_cents" integer DEFAULT 0 NOT NULL,
	"source_channel" varchar(64) NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_refund_source_not_blank" CHECK (btrim("sales_refunds"."source_system") <> ''),
	CONSTRAINT "sales_refund_currency_iso_code" CHECK ("sales_refunds"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "sales_refund_amounts_nonnegative" CHECK ("sales_refunds"."amount_cents" >= 0 and "sales_refunds"."tax_cents" >= 0 and "sales_refunds"."tip_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sales_order_lines" DROP CONSTRAINT "sales_order_line_item_product";--> statement-breakpoint
DROP INDEX "source_doc_org_hash_uidx";--> statement-breakpoint
ALTER TABLE "source_documents" ADD COLUMN "duplicate_of_document_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD COLUMN "mapping_status" "mapping_status" DEFAULT 'unmapped' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_order_modifiers" ADD COLUMN "mapping_status" "mapping_status" DEFAULT 'unmapped' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "reporting_role" varchar(32) DEFAULT 'authoritative' NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_sales_controls" ADD CONSTRAINT "daily_sales_controls_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_sales_controls" ADD CONSTRAINT "daily_sales_controls_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_links" ADD CONSTRAINT "sales_order_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_links" ADD CONSTRAINT "sales_order_links_primary_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("primary_sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_links" ADD CONSTRAINT "sales_order_links_linked_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("linked_sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_payments" ADD CONSTRAINT "sales_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_payments" ADD CONSTRAINT "sales_payments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_payments" ADD CONSTRAINT "sales_payments_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_refunds" ADD CONSTRAINT "sales_refunds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_refunds" ADD CONSTRAINT "sales_refunds_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_refunds" ADD CONSTRAINT "sales_refunds_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_refunds" ADD CONSTRAINT "sales_refunds_sales_payment_id_sales_payments_id_fk" FOREIGN KEY ("sales_payment_id") REFERENCES "public"."sales_payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connection_external_uidx" ON "integration_connections" USING btree ("organization_id","source_system","external_account_id");--> statement-breakpoint
CREATE INDEX "integration_connection_location_idx" ON "integration_connections" USING btree ("location_id","source_system");--> statement-breakpoint
CREATE INDEX "integration_connection_status_idx" ON "integration_connections" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_sales_control_source_date_uidx" ON "daily_sales_controls" USING btree ("location_id","source_system","business_date");--> statement-breakpoint
CREATE INDEX "daily_sales_control_org_date_idx" ON "daily_sales_controls" USING btree ("organization_id","business_date");--> statement-breakpoint
CREATE INDEX "daily_sales_control_status_idx" ON "daily_sales_controls" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_order_link_pair_uidx" ON "sales_order_links" USING btree ("primary_sales_order_id","linked_sales_order_id","relationship");--> statement-breakpoint
CREATE INDEX "sales_order_link_linked_idx" ON "sales_order_links" USING btree ("linked_sales_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_payment_source_external_uidx" ON "sales_payments" USING btree ("location_id","source_system","external_id");--> statement-breakpoint
CREATE INDEX "sales_payment_business_date_idx" ON "sales_payments" USING btree ("organization_id","business_date");--> statement-breakpoint
CREATE INDEX "sales_payment_order_idx" ON "sales_payments" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_payment_tender_idx" ON "sales_payments" USING btree ("location_id","tender_type","business_date");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_refund_source_external_uidx" ON "sales_refunds" USING btree ("location_id","source_system","external_id");--> statement-breakpoint
CREATE INDEX "sales_refund_business_date_idx" ON "sales_refunds" USING btree ("organization_id","business_date");--> statement-breakpoint
CREATE INDEX "sales_refund_order_idx" ON "sales_refunds" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_refund_payment_idx" ON "sales_refunds" USING btree ("sales_payment_id");--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_duplicate_of_document_id_source_documents_id_fk" FOREIGN KEY ("duplicate_of_document_id") REFERENCES "public"."source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_doc_org_hash_idx" ON "source_documents" USING btree ("organization_id","sha256");--> statement-breakpoint
CREATE INDEX "source_doc_duplicate_idx" ON "source_documents" USING btree ("duplicate_of_document_id");--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_doc_not_self_duplicate" CHECK ("source_documents"."duplicate_of_document_id" is null or "source_documents"."duplicate_of_document_id" <> "source_documents"."id");--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_line_item_product" CHECK ("sales_order_lines"."line_type" <> 'item' or "sales_order_lines"."mapping_status" <> 'confirmed' or coalesce("sales_order_lines"."product_id", "sales_order_lines"."recipe_version_id") is not null);--> statement-breakpoint
ALTER TABLE "sales_order_modifiers" ADD CONSTRAINT "sales_modifier_confirmed_target" CHECK ("sales_order_modifiers"."mapping_status" <> 'confirmed' or coalesce("sales_order_modifiers"."product_id", "sales_order_modifiers"."recipe_version_id") is not null);--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_order_reporting_role_allowed" CHECK ("sales_orders"."reporting_role" in ('authoritative', 'supplemental'));