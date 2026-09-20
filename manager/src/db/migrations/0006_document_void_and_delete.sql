CREATE OR REPLACE FUNCTION manager_protect_terminal_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status::text = 'posted' THEN
    RAISE EXCEPTION 'source document % is posted and immutable', OLD.id
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
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
