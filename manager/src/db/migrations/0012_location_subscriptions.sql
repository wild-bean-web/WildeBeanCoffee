CREATE TABLE IF NOT EXISTS "location_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  "status" varchar(32) DEFAULT 'trialing' NOT NULL,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "current_period_end" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "location_subscription_status_allowed" CHECK ("status" in ('trialing', 'active', 'past_due', 'canceled', 'unpaid'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "location_subscriptions" ADD CONSTRAINT "location_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "location_subscriptions" ADD CONSTRAINT "location_subscriptions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "location_subscription_location_uidx" ON "location_subscriptions" USING btree ("location_id");
