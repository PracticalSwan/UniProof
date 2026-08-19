-- Phase 6A private saved artifacts.
-- The table stores immutable application-owned snapshots. Ownership is enforced
-- by both explicit table privileges and row level security.

CREATE TABLE public.saved_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('profile', 'research', 'comparison', 'guide')),
  schema_version smallint NOT NULL
    CHECK (schema_version = 1),
  title text NOT NULL
    CHECK (char_length(title) >= 1 AND char_length(title) <= 120 AND btrim(title) = title),
  payload jsonb NOT NULL
    CHECK (
      jsonb_typeof(payload) = 'object'
      AND (
        (kind = 'profile' AND octet_length(payload::text) <= 32768)
        OR (kind <> 'profile' AND octet_length(payload::text) <= 4194304)
      )
    ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_artifacts_owner_list_idx
  ON public.saved_artifacts (owner_id, created_at DESC, id DESC);

ALTER TABLE public.saved_artifacts ENABLE ROW LEVEL SECURITY;

-- Explicit grants are independent from RLS. anon/PUBLIC receives no private CRUD.
REVOKE ALL ON TABLE public.saved_artifacts FROM PUBLIC;
REVOKE ALL ON TABLE public.saved_artifacts FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_artifacts TO authenticated;

CREATE POLICY saved_artifacts_authenticated_select
  ON public.saved_artifacts
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY saved_artifacts_authenticated_insert
  ON public.saved_artifacts
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY saved_artifacts_authenticated_delete
  ON public.saved_artifacts
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

-- Serialize per-owner inserts so concurrent requests cannot both observe the
-- same sub-capacity count. The lock is transaction-scoped and narrowly keyed.
CREATE FUNCTION public.enforce_saved_artifact_owner_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('public.saved_artifacts'),
    hashtext(NEW.owner_id::text)
  );

  IF (
    SELECT count(*)
    FROM public.saved_artifacts
    WHERE owner_id = NEW.owner_id
      AND id <> NEW.id
  ) >= 20
  THEN
    RAISE EXCEPTION 'saved artifact capacity reached'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER saved_artifacts_owner_cap
  BEFORE INSERT ON public.saved_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_saved_artifact_owner_cap();
