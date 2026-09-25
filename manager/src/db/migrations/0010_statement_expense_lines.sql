CREATE TABLE "statement_expense_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "business_date" date NOT NULL,
  "description" text NOT NULL,
  "expense_group" varchar(32) NOT NULL,
  "category" text NOT NULL,
  "signed_cents" integer NOT NULL,
  "source_file" text NOT NULL,
  "source_index" integer NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "statement_expense_lines" ADD CONSTRAINT "statement_expense_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "statement_expense_source_uidx" ON "statement_expense_lines" USING btree ("organization_id","source_file","source_index");
--> statement-breakpoint
CREATE INDEX "statement_expense_date_idx" ON "statement_expense_lines" USING btree ("organization_id","business_date");
