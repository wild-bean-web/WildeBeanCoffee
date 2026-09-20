CREATE TABLE "inventory_count_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"count_session_id" uuid NOT NULL,
	"count_section_id" uuid NOT NULL,
	"count_line_id" uuid NOT NULL,
	"client_observation_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"counted_quantity" numeric(20, 6) NOT NULL,
	"uom_id" uuid NOT NULL,
	"observed_at" timestamp (3) with time zone NOT NULL,
	"received_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"observed_by_staff_member_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'accepted' NOT NULL,
	"supersedes_observation_id" uuid,
	"conflict_reason" text,
	CONSTRAINT "count_observation_sequence_positive" CHECK ("inventory_count_observations"."sequence_number" > 0),
	CONSTRAINT "count_observation_quantity_nonnegative" CHECK ("inventory_count_observations"."counted_quantity" >= 0),
	CONSTRAINT "count_observation_status_allowed" CHECK ("inventory_count_observations"."status" in ('accepted', 'conflict', 'superseded', 'rejected')),
	CONSTRAINT "count_observation_not_self_superseded" CHECK ("inventory_count_observations"."supersedes_observation_id" is null or "inventory_count_observations"."supersedes_observation_id" <> "inventory_count_observations"."id")
);
--> statement-breakpoint
CREATE TABLE "inventory_count_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"count_session_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"assigned_to_staff_member_id" uuid,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"lease_expires_at" timestamp (3) with time zone,
	"submitted_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "count_section_order_positive" CHECK ("inventory_count_sections"."sort_order" > 0),
	CONSTRAINT "count_section_status_allowed" CHECK ("inventory_count_sections"."status" in ('draft', 'assigned', 'in_progress', 'submitted', 'approved'))
);
--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN "count_section_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_count_observations" ADD CONSTRAINT "inventory_count_observations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_observations" ADD CONSTRAINT "inventory_count_observations_count_session_id_inventory_count_sessions_id_fk" FOREIGN KEY ("count_session_id") REFERENCES "public"."inventory_count_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_observations" ADD CONSTRAINT "inventory_count_observations_count_section_id_inventory_count_sections_id_fk" FOREIGN KEY ("count_section_id") REFERENCES "public"."inventory_count_sections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_observations" ADD CONSTRAINT "inventory_count_observations_count_line_id_inventory_count_lines_id_fk" FOREIGN KEY ("count_line_id") REFERENCES "public"."inventory_count_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_observations" ADD CONSTRAINT "inventory_count_observations_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_observations" ADD CONSTRAINT "inventory_count_observations_observed_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("observed_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_observations" ADD CONSTRAINT "inventory_count_observations_supersedes_observation_id_inventory_count_observations_id_fk" FOREIGN KEY ("supersedes_observation_id") REFERENCES "public"."inventory_count_observations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sections" ADD CONSTRAINT "inventory_count_sections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sections" ADD CONSTRAINT "inventory_count_sections_count_session_id_inventory_count_sessions_id_fk" FOREIGN KEY ("count_session_id") REFERENCES "public"."inventory_count_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sections" ADD CONSTRAINT "inventory_count_sections_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sections" ADD CONSTRAINT "inventory_count_sections_assigned_to_staff_member_id_staff_members_id_fk" FOREIGN KEY ("assigned_to_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "count_observation_client_uidx" ON "inventory_count_observations" USING btree ("organization_id","client_observation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "count_observation_device_sequence_uidx" ON "inventory_count_observations" USING btree ("count_session_id","device_id","sequence_number");--> statement-breakpoint
CREATE UNIQUE INDEX "count_observation_supersedes_uidx" ON "inventory_count_observations" USING btree ("supersedes_observation_id") WHERE "inventory_count_observations"."supersedes_observation_id" is not null;--> statement-breakpoint
CREATE INDEX "count_observation_line_idx" ON "inventory_count_observations" USING btree ("count_line_id","observed_at");--> statement-breakpoint
CREATE INDEX "count_observation_section_status_idx" ON "inventory_count_observations" USING btree ("count_section_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "count_section_session_code_uidx" ON "inventory_count_sections" USING btree ("count_session_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "count_section_session_order_uidx" ON "inventory_count_sections" USING btree ("count_session_id","sort_order");--> statement-breakpoint
CREATE INDEX "count_section_assignee_idx" ON "inventory_count_sections" USING btree ("assigned_to_staff_member_id","status");--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_count_section_id_inventory_count_sections_id_fk" FOREIGN KEY ("count_section_id") REFERENCES "public"."inventory_count_sections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_count_line_section_idx" ON "inventory_count_lines" USING btree ("count_section_id","line_number");