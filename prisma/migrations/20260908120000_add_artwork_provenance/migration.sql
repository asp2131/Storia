-- No existing book is classified by inference.
ALTER TABLE "public"."books"
  ADD COLUMN "artwork_provenance" TEXT NOT NULL DEFAULT 'unspecified',
  ADD CONSTRAINT "books_artwork_provenance_check"
    CHECK ("artwork_provenance" IN ('unspecified', 'human_created', 'ai_assisted_or_generated'));

-- Mobile reads books directly through Supabase. RLS alone cannot protect one
-- column when an existing policy permits updates. Keep unrelated permissions
-- intact, but require a trusted server connection for provenance changes.
-- Better Auth admin authorization is enforced in the web write endpoints;
-- a Supabase authenticated JWT (including an author's) is never that authority.
CREATE FUNCTION "public"."protect_book_artwork_provenance"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     OR current_setting('role', true) IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.artwork_provenance IS DISTINCT FROM 'unspecified' THEN
        RAISE EXCEPTION 'Artwork provenance can only be set by an administrator'
          USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.artwork_provenance IS DISTINCT FROM OLD.artwork_provenance THEN
      RAISE EXCEPTION 'Artwork provenance can only be set by an administrator'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "books_protect_artwork_provenance"
BEFORE INSERT OR UPDATE ON "public"."books"
FOR EACH ROW EXECUTE FUNCTION "public"."protect_book_artwork_provenance"();
