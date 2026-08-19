BEGIN;

SELECT * FROM no_plan();

-- Fixed invented local identities; no real user data is used.
\set user_a '11111111-1111-4111-8111-111111111111'
\set user_b '22222222-2222-4222-8222-222222222222'
\set user_c '33333333-3333-4333-8333-333333333333'
\set user_cap '44444444-4444-4444-8444-444444444444'
\set user_race '55555555-5555-4555-8555-555555555555'

DELETE FROM public.saved_artifacts
WHERE owner_id IN (
  CAST(:'user_a' AS uuid), CAST(:'user_b' AS uuid), CAST(:'user_c' AS uuid),
  CAST(:'user_cap' AS uuid), CAST(:'user_race' AS uuid)
);
DELETE FROM auth.users
WHERE id IN (
  CAST(:'user_a' AS uuid), CAST(:'user_b' AS uuid), CAST(:'user_c' AS uuid),
  CAST(:'user_cap' AS uuid), CAST(:'user_race' AS uuid)
);

INSERT INTO auth.users (id, email) VALUES
  (CAST(:'user_a' AS uuid), 'invented-a@example.com'),
  (CAST(:'user_b' AS uuid), 'invented-b@example.com'),
  (CAST(:'user_c' AS uuid), 'invented-c@example.com'),
  (CAST(:'user_cap' AS uuid), 'invented-cap@example.com'),
  (CAST(:'user_race' AS uuid), 'invented-race@example.com');

SELECT has_table('public', 'saved_artifacts', 'table public.saved_artifacts exists');
SELECT columns_are(
  'public',
  'saved_artifacts',
  ARRAY['id', 'owner_id', 'kind', 'schema_version', 'title', 'payload', 'created_at'],
  'table has the closed persisted columns'
);
SELECT is(
  (SELECT count(*) FROM pg_constraint
   WHERE conrelid = 'public.saved_artifacts'::regclass AND contype = 'p'),
  1::bigint,
  'saved artifacts use a primary key'
);
SELECT is(
  (SELECT count(*) FROM pg_constraint
   WHERE conrelid = 'public.saved_artifacts'::regclass
     AND contype = 'f'
     AND confrelid = 'auth.users'::regclass),
  1::bigint,
  'saved artifacts reference auth users'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.saved_artifacts'::regclass),
  true,
  'row level security is enabled'
);
SELECT has_index(
  'public',
  'saved_artifacts',
  'saved_artifacts_owner_list_idx',
  ARRAY['owner_id', 'created_at', 'id'],
  'owner list index matches the bounded query'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.saved_artifacts', 'SELECT'),
  'anon has no SELECT privilege'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.saved_artifacts', 'INSERT'),
  'anon has no INSERT privilege'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.saved_artifacts', 'UPDATE'),
  'anon has no UPDATE privilege'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.saved_artifacts', 'DELETE'),
  'anon has no DELETE privilege'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.saved_artifacts', 'SELECT'),
  'authenticated has SELECT'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.saved_artifacts', 'INSERT'),
  'authenticated has INSERT'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.saved_artifacts', 'UPDATE'),
  'authenticated has no ordinary UPDATE privilege'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.saved_artifacts', 'DELETE'),
  'authenticated has DELETE'
);
SELECT is(
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'saved_artifacts' AND cmd = 'UPDATE'),
  0::bigint,
  'no UPDATE RLS policy exists'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'user_a', 'role', 'authenticated')::text,
  true
);

SELECT lives_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'research', 1, 'Applicant research', '{"dossier":true}')$$,
    :'user_a'
  ),
  'authenticated user can insert an owned artifact'
);
SELECT is(
  (SELECT count(*) FROM public.saved_artifacts WHERE owner_id = CAST(:'user_a' AS uuid)),
  1::bigint,
  'authenticated user sees only owned rows'
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'user_b', 'role', 'authenticated')::text,
  true
);
SELECT lives_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'guide', 1, 'Applicant guide', '{"guide":true}')$$,
    :'user_b'
  ),
  'second authenticated user can insert an owned artifact'
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'user_a', 'role', 'authenticated')::text,
  true
);
SELECT is(
  (SELECT count(*) FROM public.saved_artifacts WHERE owner_id = CAST(:'user_b' AS uuid)),
  0::bigint,
  'user A cannot select user B rows through RLS'
);
SELECT is(
  (SELECT count(*) FROM public.saved_artifacts WHERE owner_id = CAST(:'user_b' AS uuid)),
  0::bigint,
  'user A cannot lock or update user B rows through RLS'
);
SELECT throws_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'research', 1, 'Forged owner', '{"dossier":true}')$$,
    :'user_b'
  ),
  'new row violates row-level security policy for table "saved_artifacts"',
  CAST('forged owner insert fails the WITH CHECK predicate' AS text)
);
SELECT throws_ok(
  format(
    $$UPDATE public.saved_artifacts SET title = 'Changed' WHERE owner_id = %L$$,
    :'user_a'
  ),
  'permission denied for table saved_artifacts',
  CAST('ordinary UPDATE is denied by table privileges' AS text)
);

RESET ROLE;
SELECT lives_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'profile', 1, 'Applicant profile', '{"profile":true}')$$,
    :'user_c'
  ),
  'third user has an owned artifact before cascade'
);
SELECT is(
  (SELECT count(*) FROM public.saved_artifacts WHERE owner_id = CAST(:'user_c' AS uuid)),
  1::bigint,
  'owned artifact exists before user deletion'
);
DELETE FROM auth.users WHERE id = CAST(:'user_c' AS uuid);
SELECT is(
  (SELECT count(*) FROM public.saved_artifacts WHERE owner_id = CAST(:'user_c' AS uuid)),
  0::bigint,
  'deleting an auth user cascades owned artifacts'
);

SELECT throws_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'invalid', 1, 'Invalid kind', '{"value":true}')$$,
    :'user_a'
  ),
  'new row for relation "saved_artifacts" violates check constraint "saved_artifacts_kind_check"',
  CAST('closed kind constraint rejects unknown values' AS text)
);
SELECT throws_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'research', 2, 'Invalid version', '{"value":true}')$$,
    :'user_a'
  ),
  'new row for relation "saved_artifacts" violates check constraint "saved_artifacts_schema_version_check"',
  CAST('schema version constraint rejects version 2' AS text)
);
SELECT throws_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'research', 1, '', '{"value":true}')$$,
    :'user_a'
  ),
  'new row for relation "saved_artifacts" violates check constraint "saved_artifacts_title_check"',
  CAST('title constraint rejects an empty presentation label' AS text)
);
SELECT throws_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'research', 1, 'Invalid payload', '["not","an","object"]')$$,
    :'user_a'
  ),
  'new row for relation "saved_artifacts" violates check constraint "saved_artifacts_check"',
  CAST('payload must be a JSON object' AS text)
);

SELECT lives_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'profile', 1, 'Boundary profile', jsonb_build_object('a', repeat('x', %s)))$$,
    :'user_a',
    32768 - 9
  ),
  'a profile payload of exactly 32 KiB serialized JSON is accepted'
);
SELECT throws_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'profile', 1, 'Oversize profile', jsonb_build_object('a', repeat('x', %s)))$$,
    :'user_a',
    32769 - 9
  ),
  'new row for relation "saved_artifacts" violates check constraint "saved_artifacts_check"',
  CAST('a profile payload over 32 KiB serialized JSON is rejected' AS text)
);
SELECT lives_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'research', 1, 'Boundary research', jsonb_build_object('a', repeat('x', %s)))$$,
    :'user_a',
    4194304 - 9
  ),
  'a research payload of exactly 4 MiB serialized JSON is accepted'
);
SELECT throws_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'comparison', 1, 'Oversize comparison', jsonb_build_object('a', repeat('x', %s)))$$,
    :'user_a',
    4194305 - 9
  ),
  'new row for relation "saved_artifacts" violates check constraint "saved_artifacts_check"',
  CAST('a comparison payload over 4 MiB serialized JSON is rejected' AS text)
);

SELECT lives_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      SELECT %L, 'profile', 1, 'Cap ' || g, '{"g":true}'
      FROM generate_series(1, 20) AS g$$,
    :'user_cap'
  ),
  'exactly 20 artifacts may be saved for one owner'
);
SELECT throws_ok(
  format(
    $$INSERT INTO public.saved_artifacts (owner_id, kind, schema_version, title, payload)
      VALUES (%L, 'profile', 1, 'Twenty-one', '{"g":true}')$$,
    :'user_cap'
  ),
  'saved artifact capacity reached',
  CAST('the 21st artifact is rejected without deleting older data' AS text)
);
SELECT is(
  (SELECT count(*) FROM public.saved_artifacts WHERE owner_id = CAST(:'user_cap' AS uuid)),
  20::bigint,
  'capacity enforcement preserves all 20 existing artifacts'
);

INSERT INTO public.saved_artifacts
  (id, owner_id, kind, schema_version, title, payload, created_at)
VALUES
  ('66666666-6666-4666-8666-666666666666', CAST(:'user_a' AS uuid), 'research', 1, 'Order A', '{"order":1}', '2099-08-19T00:00:00Z'),
  ('55555555-6666-4666-8666-666666666665', CAST(:'user_a' AS uuid), 'guide', 1, 'Order B', '{"order":2}', '2099-08-19T00:00:00Z'),
  ('77777777-7777-4777-8777-777777777777', CAST(:'user_a' AS uuid), 'comparison', 1, 'Order C', '{"order":3}', '2099-08-18T00:00:00Z');

SELECT is(
  (
    SELECT string_agg(top.id::text, ',' ORDER BY top.created_at DESC, top.id DESC)
    FROM (
      SELECT id, created_at
      FROM public.saved_artifacts
      WHERE owner_id = CAST(:'user_a' AS uuid)
      ORDER BY created_at DESC, id DESC
      LIMIT 3
    ) AS top
  ),
  (
    SELECT string_agg(expected_id::text, ',' ORDER BY expected_created_at DESC, expected_id::uuid DESC)
    FROM (
      VALUES
        ('2099-08-19T00:00:00Z', '66666666-6666-4666-8666-666666666666'),
        ('2099-08-19T00:00:00Z', '55555555-6666-4666-8666-666666666665'),
        ('2099-08-18T00:00:00Z', '77777777-7777-4777-8777-777777777777')
    ) AS ordered(expected_created_at, expected_id)
  )::text,
  'bounded list ordering is created_at descending then id descending'
);

SELECT has_function('public', 'enforce_saved_artifact_owner_cap', 'capacity trigger function exists');
SELECT is(
  (SELECT prosecdef FROM pg_proc
   WHERE oid = 'public.enforce_saved_artifact_owner_cap()'::regprocedure),
  false,
  'capacity trigger is security invoker'
);
SELECT ok(
  (SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid = 'public.enforce_saved_artifact_owner_cap()'::regprocedure),
  'capacity trigger has a fixed search_path'
);

SELECT * FROM finish();

ROLLBACK;
