CREATE OR REPLACE FUNCTION manager_protect_terminal_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status::text = 'posted' THEN
      RAISE EXCEPTION 'source document % is posted and immutable', OLD.id
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status::text = 'posted' THEN
    IF OLD.document_type::text = 'payroll'
       AND NEW.status::text = 'voided' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'source document % is posted and immutable', OLD.id
      USING ERRCODE = '55000';
  END IF;

  IF OLD.status::text = 'voided' THEN
    RAISE EXCEPTION 'source document % is voided and immutable', OLD.id
      USING ERRCODE = '55000';
  END IF;

  IF OLD.status::text IN ('duplicate', 'failure')
     AND NEW.status::text IS DISTINCT FROM 'voided' THEN
    RAISE EXCEPTION 'source document % is terminal and immutable', OLD.id
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP INDEX IF EXISTS "source_doc_source_external_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "source_doc_source_external_uidx" ON "source_documents" USING btree ("organization_id","location_id","source_system","external_id") WHERE "source_documents"."external_id" is not null AND "source_documents"."status" <> 'voided' AND "source_documents"."status" <> 'duplicate';
--> statement-breakpoint
CREATE UNIQUE INDEX "source_doc_location_active_hash_uidx" ON "source_documents" USING btree ("location_id","sha256") WHERE "source_documents"."status" <> 'voided' AND "source_documents"."status" <> 'duplicate';
