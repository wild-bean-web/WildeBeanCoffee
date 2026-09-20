ALTER TYPE "source_document_type" ADD VALUE IF NOT EXISTS 'payroll';--> statement-breakpoint
CREATE TYPE "payroll_run_status" AS ENUM('draft', 'posted', 'voided');--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"accounting_period_id" uuid,
	"status" "payroll_run_status" DEFAULT 'draft' NOT NULL,
	"company_name" text,
	"check_date" date,
	"period_starts_on" date,
	"period_ends_on" date,
	"batch_reference" varchar(96),
	"employee_count" integer DEFAULT 0 NOT NULL,
	"regular_hours" numeric(20, 6) DEFAULT '0' NOT NULL,
	"overtime_hours" numeric(20, 6) DEFAULT '0' NOT NULL,
	"total_hours" numeric(20, 6) DEFAULT '0' NOT NULL,
	"regular_wages_cents" integer DEFAULT 0 NOT NULL,
	"overtime_wages_cents" integer DEFAULT 0 NOT NULL,
	"tips_cents" integer DEFAULT 0 NOT NULL,
	"wages_cents" integer DEFAULT 0 NOT NULL,
	"gross_cents" integer DEFAULT 0 NOT NULL,
	"employee_tax_cents" integer DEFAULT 0 NOT NULL,
	"net_pay_cents" integer DEFAULT 0 NOT NULL,
	"employer_tax_cents" integer DEFAULT 0 NOT NULL,
	"loaded_labor_cents" integer DEFAULT 0 NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"posted_at" timestamp(3) with time zone,
	"posted_by_staff_member_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_run_employee_count_nonnegative" CHECK ("payroll_runs"."employee_count" >= 0),
	CONSTRAINT "payroll_run_money_nonnegative" CHECK ("payroll_runs"."regular_wages_cents" >= 0 AND "payroll_runs"."overtime_wages_cents" >= 0 AND "payroll_runs"."tips_cents" >= 0 AND "payroll_runs"."wages_cents" >= 0 AND "payroll_runs"."gross_cents" >= 0 AND "payroll_runs"."employee_tax_cents" >= 0 AND "payroll_runs"."net_pay_cents" >= 0 AND "payroll_runs"."employer_tax_cents" >= 0 AND "payroll_runs"."loaded_labor_cents" >= 0),
	CONSTRAINT "payroll_run_posting_state" CHECK ("payroll_runs"."status" <> 'posted' OR "payroll_runs"."posted_at" IS NOT NULL)
);--> statement-breakpoint
CREATE TABLE "payroll_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"display_name" text NOT NULL,
	"family_name" text NOT NULL,
	"given_name" text NOT NULL,
	"regular_hours" numeric(20, 6) DEFAULT '0' NOT NULL,
	"overtime_hours" numeric(20, 6) DEFAULT '0' NOT NULL,
	"total_hours" numeric(20, 6) DEFAULT '0' NOT NULL,
	"regular_rate" numeric(20, 6),
	"overtime_rate" numeric(20, 6),
	"regular_wages_cents" integer DEFAULT 0 NOT NULL,
	"overtime_wages_cents" integer DEFAULT 0 NOT NULL,
	"tips_cents" integer DEFAULT 0 NOT NULL,
	"wages_cents" integer DEFAULT 0 NOT NULL,
	"gross_cents" integer DEFAULT 0 NOT NULL,
	"employee_tax_cents" integer DEFAULT 0 NOT NULL,
	"net_pay_cents" integer DEFAULT 0 NOT NULL,
	"employer_tax_cents" integer DEFAULT 0 NOT NULL,
	"loaded_labor_cents" integer DEFAULT 0 NOT NULL,
	"earnings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"employee_taxes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"employer_liabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_employee_line_positive" CHECK ("payroll_employees"."line_number" > 0),
	CONSTRAINT "payroll_employee_name_not_blank" CHECK (btrim("payroll_employees"."display_name") <> '')
);--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_accounting_period_id_accounting_periods_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_posted_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("posted_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_employees" ADD CONSTRAINT "payroll_employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_employees" ADD CONSTRAINT "payroll_employees_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_run_source_document_uidx" ON "payroll_runs" USING btree ("source_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_run_location_period_uidx" ON "payroll_runs" USING btree ("location_id","period_starts_on","period_ends_on","check_date") WHERE "payroll_runs"."status" <> 'voided';--> statement-breakpoint
CREATE INDEX "payroll_run_location_status_idx" ON "payroll_runs" USING btree ("location_id","status","period_ends_on");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_employee_run_line_uidx" ON "payroll_employees" USING btree ("payroll_run_id","line_number");--> statement-breakpoint
CREATE INDEX "payroll_employee_run_name_idx" ON "payroll_employees" USING btree ("payroll_run_id","family_name");
