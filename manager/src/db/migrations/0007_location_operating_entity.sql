ALTER TABLE "source_documents" DISABLE TRIGGER source_documents_terminal_immutable;--> statement-breakpoint
UPDATE source_documents AS documents
SET location_id = first_location.id
FROM (
  SELECT DISTINCT ON (organization_id) id, organization_id
  FROM locations
  WHERE is_active = true
  ORDER BY organization_id, created_at
) AS first_location
WHERE documents.location_id IS NULL
  AND documents.organization_id = first_location.organization_id;
--> statement-breakpoint
ALTER TABLE "source_documents" ENABLE TRIGGER source_documents_terminal_immutable;--> statement-breakpoint
ALTER TABLE "source_documents" ALTER COLUMN "location_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "location_id_org_uidx" ON "locations" USING btree ("id","organization_id");--> statement-breakpoint
CREATE INDEX "source_doc_location_status_received_idx" ON "source_documents" USING btree ("location_id","status","received_at");--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_doc_location_org_fk" FOREIGN KEY ("location_id","organization_id") REFERENCES "locations"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
DROP INDEX IF EXISTS "source_doc_source_external_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "source_doc_source_external_uidx" ON "source_documents" USING btree ("organization_id","location_id","source_system","external_id") WHERE "source_documents"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "source_doc_location_hash_idx" ON "source_documents" USING btree ("location_id","sha256");
