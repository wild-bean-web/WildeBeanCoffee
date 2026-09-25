ALTER TABLE "statement_expense_lines" ADD COLUMN "fingerprint" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "statement_expense_fingerprint_uidx" ON "statement_expense_lines" USING btree ("organization_id","fingerprint") WHERE fingerprint is not null;
--> statement-breakpoint
CREATE TABLE "statement_uploads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "sha256" text NOT NULL,
  "filename" text NOT NULL,
  "status" varchar(40) NOT NULL,
  "starts_on" date,
  "ends_on" date,
  "parsed_count" integer DEFAULT 0 NOT NULL,
  "added_count" integer DEFAULT 0 NOT NULL,
  "skipped_count" integer DEFAULT 0 NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "statement_uploads" ADD CONSTRAINT "statement_uploads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "statement_uploads_org_sha_uidx" ON "statement_uploads" USING btree ("organization_id","sha256");
--> statement-breakpoint
CREATE INDEX "statement_uploads_recent_idx" ON "statement_uploads" USING btree ("organization_id","created_at");
