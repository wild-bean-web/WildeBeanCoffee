CREATE OR REPLACE FUNCTION manager_reject_all_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; use a reversal record', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION manager_reject_all_mutation();
--> statement-breakpoint
CREATE TRIGGER inventory_movements_append_only
BEFORE UPDATE OR DELETE ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION manager_reject_all_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION manager_protect_terminal_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status::text IN ('posted', 'reversed') THEN
      RAISE EXCEPTION '% record % is posted and immutable', TG_TABLE_NAME, OLD.id
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status::text IN ('posted', 'reversed') THEN
    RAISE EXCEPTION '% record % is posted and immutable', TG_TABLE_NAME, OLD.id
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER purchases_terminal_immutable
BEFORE UPDATE OR DELETE ON purchases
FOR EACH ROW EXECUTE FUNCTION manager_protect_terminal_status();
--> statement-breakpoint
CREATE TRIGGER goods_receipts_terminal_immutable
BEFORE UPDATE OR DELETE ON goods_receipts
FOR EACH ROW EXECUTE FUNCTION manager_protect_terminal_status();
--> statement-breakpoint
CREATE TRIGGER journal_batches_terminal_immutable
BEFORE UPDATE OR DELETE ON journal_batches
FOR EACH ROW EXECUTE FUNCTION manager_protect_terminal_status();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION manager_protect_posted_journal_line()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  batch_status text;
BEGIN
  SELECT status::text INTO batch_status
  FROM journal_batches
  WHERE id = OLD.journal_batch_id;

  IF batch_status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'journal line % belongs to an immutable batch', OLD.id
      USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER journal_lines_posted_immutable
BEFORE UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION manager_protect_posted_journal_line();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION manager_protect_terminal_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status::text IN ('posted', 'duplicate', 'failure', 'voided') THEN
    RAISE EXCEPTION 'source document % is terminal and immutable', OLD.id
      USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER source_documents_terminal_immutable
BEFORE UPDATE OR DELETE ON source_documents
FOR EACH ROW EXECUTE FUNCTION manager_protect_terminal_document();