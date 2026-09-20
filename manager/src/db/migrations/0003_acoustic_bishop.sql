CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"import_kind" varchar(96) NOT NULL,
	"source_filename" text NOT NULL,
	"source_sha256" varchar(64) NOT NULL,
	"parser_version" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'staged' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"ready_count" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"approved_by_staff_member_id" uuid,
	"approved_at" timestamp (3) with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batch_status_allowed" CHECK ("import_batches"."status" in ('staged', 'reviewing', 'approved', 'posted', 'failed', 'voided')),
	CONSTRAINT "import_batch_counts_nonnegative" CHECK ("import_batches"."row_count" >= 0 and "import_batches"."ready_count" >= 0 and "import_batches"."review_count" >= 0),
	CONSTRAINT "import_batch_sha_format" CHECK ("import_batches"."source_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"import_batch_id" uuid NOT NULL,
	"source_row_number" integer NOT NULL,
	"status" varchar(32) DEFAULT 'needs_review' NOT NULL,
	"raw_data" jsonb NOT NULL,
	"normalized_data" jsonb NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_entity_type" varchar(96),
	"target_entity_id" uuid,
	"reviewed_by_staff_member_id" uuid,
	"reviewed_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_row_source_positive" CHECK ("import_rows"."source_row_number" > 0),
	CONSTRAINT "import_row_status_allowed" CHECK ("import_rows"."status" in ('ready', 'needs_review', 'approved', 'posted', 'rejected')),
	CONSTRAINT "import_row_target_pair" CHECK (("import_rows"."target_entity_type" is null) = ("import_rows"."target_entity_id" is null))
);
--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_approved_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("approved_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_reviewed_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("reviewed_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_batch_source_parser_uidx" ON "import_batches" USING btree ("organization_id","import_kind","source_sha256","parser_version");--> statement-breakpoint
CREATE INDEX "import_batch_status_idx" ON "import_batches" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "import_row_batch_source_uidx" ON "import_rows" USING btree ("import_batch_id","source_row_number");--> statement-breakpoint
CREATE INDEX "import_row_batch_status_idx" ON "import_rows" USING btree ("import_batch_id","status","source_row_number");--> statement-breakpoint
CREATE INDEX "import_row_target_idx" ON "import_rows" USING btree ("organization_id","target_entity_type","target_entity_id");