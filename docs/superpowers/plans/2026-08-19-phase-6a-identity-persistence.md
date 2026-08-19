# Phase 6A Identity, Ownership, and Persistence Implementation Plan

> **For Codex GLM-5.3 Max:** ZERO SUBAGENTS for this entire Phase 6A batch. Do not spawn, delegate to, or invoke reviewer/specialist/subagent processes. Execute planning checks, implementation, testing, security/privacy review, accessibility review, documentation synchronization, and the final independent-style defect review in the main agent only. Follow `AGENTS.md` and the applicable local skills inline.

**Goal:** Add optional Supabase authentication and a private, cross-device-ready saved-snapshot architecture without making auth mandatory, exposing applicant data to Research providers, weakening evidence semantics, or trusting browser-supplied ownership.

**Architecture:** Keep Research/Compare/Guide anonymous-first. Compose Supabase SSR session refresh and the exact configured Supabase browser-connect origin into the existing CSP-owning Next.js Proxy, derive identity server-side at the assurance level required by each operation, persist explicit immutable versioned artifacts behind strict same-origin private APIs and RLS, and develop/test the entire database/Auth boundary locally with the installed Supabase CLI before any hosted mutation. Hosted cross-device behavior is not claimed until Phase 6C verifies the remote deployment.

**Tech Stack:** Next.js 16.3.1 App Router/Proxy, React 19.2.8, TypeScript, Zod 4, existing `@supabase/ssr`/`@supabase/supabase-js`, Supabase PostgreSQL/Auth/RLS, Supabase CLI 2.114.0, Vitest 4.1.10, Playwright 1.62.1.

**Spec:** `docs/planning/phase-6-hardening-submission-readiness.md`, especially Sections 3–4 and 7–9.

## Global constraints

- Planning is already approved; implementation must still obey `AGENTS.md` external-action gates.
- **Local-only Supabase work in this batch.** Do not `supabase link`, use `--linked`, push to a hosted project, alter hosted Auth/SMTP settings, retrieve remote secrets, or touch production data.
- **ZERO SUBAGENTS.** Do not use a reviewer agent, specialist agent, parallel agent, or any delegated implementation/testing/review path. The main GLM-5.3 Max agent performs the entire batch and final independent-style review inline.
- Do not commit/push/open a PR unless separately requested.
- Do not modify or delete `ui-flow-screenshots/`.
- Do not add a new auth library: the required Supabase packages already exist.
- Do not add direct browser CRUD to private Supabase tables.
- Do not use `SUPABASE_SERVICE_ROLE_KEY` for ordinary user paths or tests.
- Do not add `/api/guide`, `/api/compare`, profile-aware Research, AI admission scoring, analytics, or document uploads.
- Do not introduce browser Web Storage/IndexedDB/Cache Storage/service-worker persistence for auth/private artifacts.
- Use invented emails/profile data in every local test and screenshot.
- In the CodexPro WSL shell, invoke the installed Windows Supabase CLI through `/mnt/c/Windows/System32/cmd.exe /d /s /c "supabase ..."` when direct invocation cannot find Windows Node.
- Apply TDD: produce a failing focused test before each behavioral fix where practical.

---

## Task 1 — Re-read the live baseline and freeze Phase 6A contracts

**Read:**
- `LESSONS.md`
- `AGENT_MEMORY.md`
- `AGENTS.md`
- `docs/planning/phase-6-hardening-submission-readiness.md`
- `docs/requirements.md`
- `docs/design.md`
- `docs/security.md`
- `docs/security-threat-model.md`
- `proxy.ts`
- `app/layout.tsx`
- `components/layout/site-header.tsx`
- `lib/security/browser-policy.ts`
- `lib/env/public.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `components/research/research-workspace.tsx`
- `lib/research/mode/client-state.ts`
- `lib/research/mode/public-contracts.ts`
- `components/compare/compare-workspace.tsx`
- `lib/comparison/contracts.ts`
- `lib/comparison/client-state.ts`
- `components/guide/guide-workspace.tsx`
- `lib/guide/contracts.ts`
- `lib/guide/client-state.ts`
- `lib/guide/assessment.ts`
- `lib/guide/planning.ts`
- `lib/guide/requirement-registry.ts`
- the current Phase 3/4/5 E2E/unit regressions that protect evidence ownership, cancellation, unsupported targets, and Guide evidence semantics.

- [ ] Confirm the real Git root, branch, status, and current Phase 4/5 user-owned changes before editing. Preserve all approved dirty-tree work; do not reset, stash, clean, or rewrite it.
- [ ] Read the current lightweight Supabase changelog index first and inspect any relevant Auth/SSR/RLS/CLI breaking-change entries, then confirm current official Supabase SSR/Auth docs still recommend the intended cookie-based PKCE, `getClaims()` Proxy refresh, `getUser()` Auth-server validation where current logout/session state is required, and RLS patterns. If a material API/security recommendation changed since 2026-08-19, update the spec before code.
- [ ] Confirm `@supabase/ssr` and `@supabase/supabase-js` versions in the current lockfile; do not upgrade merely because newer versions exist unless current code cannot implement the plan safely.
- [ ] Freeze these **current post-audit invariants** before implementation and identify the exact existing tests that protect them: catalog-owned official university/program links; source-owned evidence links; target-scoped evidence refs; unsupported-target correction; previous-result preservation; Guide intake/year finalizer binding; exact/closed Guide aliases; context-rejected evidence remaining inspectable but ineligible; all competing evidence refs remaining visible; cancellation re-check after post-response UI awaits; and stale request ownership rejection.
- [ ] Write/confirm one application contract for `SavedArtifactKind = 'profile' | 'research' | 'comparison' | 'guide'`, `schemaVersion = 1`, payload/body/count limits, server-derived titles, memory-only restore handoff, and the exact sanitized persistence error vocabulary from the canonical Phase 6 spec.
- [ ] Preserve the invariant that a saved artifact is a historical snapshot and cannot silently become current evidence, current Guide assessment, or current Compare scoring.

**Gate:** no code until the current docs/API and live source agree on the auth/session pattern.

---

## Task 2 — Initialize a reproducible local Supabase project without remote linkage

**Create if absent:**
- `supabase/config.toml`
- `supabase/seed.sql` only if deterministic invented seed data is actually useful; otherwise keep seeds in tests.

- [ ] Verify Docker-compatible local runtime availability before `supabase start`.
- [ ] Run `supabase --help` and the relevant `supabase db ... --help`/`supabase test ... --help` commands on the installed 2.114.0 CLI before relying on flags from this plan; discover current CLI syntax rather than guessing it.
- [ ] Run the Windows Supabase CLI `supabase init` only if `supabase/` does not exist.
- [ ] Inspect generated files and remove only irrelevant generated examples; do not accept broad default config blindly.
- [ ] Confirm the project uses imperative migrations (no existing declarative `supabase/schemas/`/`schema_paths` workflow). Create the migration with `supabase migration new phase6_saved_artifacts` and edit the CLI-generated file; do not invent a timestamped migration filename manually.
- [ ] Configure local Auth Site URL/callbacks for the test origin only.
- [ ] Keep local Auth email capture inside local Mailpit; no real email sending.
- [ ] Ensure generated local secrets/config are ignored where required and no secret is committed.
- [ ] Run `supabase start`, record only non-secret service health/URLs needed by tests, and do not echo generated keys into chat/docs.

**Verification:**
- [ ] `supabase status` confirms local services only.
- [ ] No linked project ref/config exists.
- [ ] repository secret scan finds no newly introduced real secrets.

---

## Task 3 — Add the immutable saved-artifact database migration

**Create via CLI:**
- the exact `supabase/migrations/<cli-generated-timestamp>_phase6_saved_artifacts.sql` produced by `supabase migration new phase6_saved_artifacts`.

Migration requirements:

- [ ] Create `public.saved_artifacts` with UUID PK, `owner_id -> auth.users(id) ON DELETE CASCADE`, closed `kind`, `schema_version`, bounded `title`, JSONB `payload`, and `created_at`.
- [ ] `title` is application-derived presentation metadata, not user input or an authorization/restore field. The API derives profile -> `Applicant profile`, Research/Guide -> current catalog target label, Comparison -> a bounded public target summary; no rename/update feature exists in Phase 6A.
- [ ] Require JSON object payloads; reject null/scalar/array payloads.
- [ ] Encode per-kind payload ceilings with a deterministic textual-byte expression such as `octet_length(payload::text)` rather than `pg_column_size(jsonb)`, whose internal/compressed storage size is not the API serialization boundary: profile <= 32 KiB; other artifacts <= 4 MiB. Keep the server UTF-8/body checks authoritative as a second independent layer.
- [ ] Add only indexes justified by access paths: at minimum owner + descending `(created_at,id)` ordering for the bounded Saved list. Do not add cursor/offset pagination indexes or speculative indexes; an owner can hold at most 20 rows.
- [ ] Enable RLS in the same migration before granting useful authenticated access.
- [ ] Inspect the local Supabase generated privilege baseline, then explicitly revoke private-table CRUD from `anon`/`PUBLIC` as needed. Do not assume an absent RLS policy substitutes for table privileges.
- [ ] Explicitly grant `authenticated` only `SELECT`, `INSERT`, and `DELETE` on `saved_artifacts`; revoke/no-grant ordinary `UPDATE`.
- [ ] Add separate authenticated RLS policies using `(select auth.uid()) = owner_id`: `SELECT`/`DELETE` through `USING`, and `INSERT` through `WITH CHECK`; do not use deprecated `auth.role()` or user-editable metadata for authorization.
- [ ] Ensure forged insert owner fails through `WITH CHECK` even when the caller holds the normal authenticated table grants.
- [ ] Implement the 20-artifact-per-owner cap atomically at the database boundary. If using an advisory-lock trigger/function, fix `search_path`, scope the lock to owner + table, and keep it security-invoker unless a stronger privilege is strictly necessary and justified.
- [ ] Do not auto-delete the oldest artifact when at capacity; reject the new save so user data is never silently discarded.
- [ ] Do not create generic privileged CRUD functions.

### Migration RED/GREEN

**Create:** `supabase/tests/database/saved_artifacts.test.sql`

Before finalizing implementation, write pgTAP cases that fail against the empty schema and then pass after the migration:

- [ ] table/columns/constraints exist;
- [ ] RLS enabled;
- [ ] `anon`/`PUBLIC` has no private-table CRUD privilege and cannot read/write/delete through RLS/Data API context;
- [ ] `authenticated` has exactly the intended `SELECT`/`INSERT`/`DELETE` table privileges and no ordinary `UPDATE` privilege;
- [ ] User A sees own rows only;
- [ ] User B cannot read/delete A;
- [ ] A cannot insert a row owned by B even with normal authenticated table grants;
- [ ] no UPDATE path exists through either privilege or policy;
- [ ] deleted auth user cascades owned rows;
- [ ] invalid kind/version/title/payload rejected;
- [ ] profile exact/over 32 KiB boundary;
- [ ] non-profile exact/over 4 MiB boundary;
- [ ] 20 saves succeed, 21st fails;
- [ ] two concurrent-cap attempts cannot both push an owner over 20;
- [ ] stable descending `(created_at,id)` ordering matches the bounded list query.

**Local verification:**
- [ ] `supabase db reset`
- [ ] `supabase db lint`
- [ ] run the installed CLI's database advisor command discovered via `--help`; fix relevant security/performance findings and record any inapplicable advisory with evidence rather than suppressing it blindly;
- [ ] `supabase test db`

Do not use `--linked`.

---

## Task 4 — Add shared catalog presentation guards and versioned persistence contracts

**Create:**
- `lib/research/catalog/presentation.ts`
- `lib/persistence/contracts.ts`
- `tests/phase6a-catalog-presentation.test.ts`
- `tests/phase6a-persistence-contracts.test.ts`

**Modify after regression coverage exists:**
- `components/research/research-workspace.tsx`
- `components/compare/compare-workspace.tsx`
- `components/guide/guide-workspace.tsx`
- `lib/guide/contracts.ts` only for exact Guide runtime result schemas if needed
- the smallest owning comparison module only if `ComparisonResult` needs an exact runtime schema

**Use existing types/schemas from:**
- `lib/guide/contracts.ts`
- `lib/comparison/contracts.ts`
- `lib/comparison/client-state.ts`
- `lib/research/mode/public-contracts.ts`

Implementation contract:

- [ ] Add one pure shared catalog binder such as `bindCatalogOwnedResearchTarget(dossier, catalog): ResearchDossier | null`. It validates university ID plus program ID/owning university, replaces only application-owned `websiteUrl`/`officialUrl` from the current catalog, preserves every dossier source/evidence URL and all other evidence data byte-for-byte/value-for-value, and returns `null` when the target no longer resolves. Do not broaden the catalog or rewrite source provenance.
- [ ] Add RED tests first for the three current presentation behaviors: hostile same-ID official URLs are replaced by catalog URLs; source/evidence URLs are untouched; wrong university/program ownership or removed targets fail closed. Then migrate the existing Research/Compare/Guide local binder logic to this one helper without changing successful Phase 3–5 UI behavior.
- [ ] Define strict Zod schemas for save request, bounded list metadata, saved row projection, memory-only restore envelope, and sanitized error envelope.
- [ ] Define a closed discriminated artifact payload schema for `schemaVersion: 1`.
- [ ] The POST save contract contains only `kind`, `schemaVersion`, and `payload`; no `ownerId`, email, free-form title, target URL, or restore route is accepted. The server derives owner and title.
- [ ] Use the exact public persistence error codes from the canonical Phase 6 spec; do not create mode-specific variants for equivalent failures.
- [ ] Do not duplicate Research schemas by hand if an authoritative Zod schema exists; compose/reuse it.
- [ ] `ComparisonResult` and `GuideResult` are currently TypeScript-only at the Phase 5 baseline. Add the smallest exact runtime schemas next to their owning subsystems and validate all nested outcomes/evidence refs/arrays, not a weaker `z.unknown()`/JSON-object cast.
- [ ] Treat database rows as untrusted user-controlled persisted input even after RLS ownership succeeds. Re-parse the row and payload on every GET/restore and re-run application-owned target/evidence binding invariants before display.
- [ ] A read of an unknown `kind`/`schemaVersion` fails with `snapshot-unsupported-version`; never partially parse or coerce it into the current version.
- [ ] Derive and bound the saved title after payload/catalog validation; never trust a stored title to resolve a target or choose a mode.
- [ ] Measure serialized UTF-8 bytes, not JavaScript character count, for payload-size acceptance.
- [ ] Never truncate supporting text, sources, evidence refs, outcomes, assessments, risks, checklist items, or timeline entries to fit.
- [ ] Preserve every target-scoped `{targetKey, claimId}` reference exactly, including multiple competing refs and refs attached to context-rejected/manual Guide outcomes. Serialization/deserialization must never collapse an evidence array to the first ref.
- [ ] Restoring a target no longer present under the same university/program relationship in the current catalog fails `snapshot-target-unavailable`; never fall back to saved `websiteUrl`/`officialUrl`.

**RED cases:**
- [ ] unknown extra top-level keys;
- [ ] unknown artifact kind;
- [ ] version 0/2;
- [ ] payload kind mismatch;
- [ ] caller-supplied `ownerId`, email, title, or target URL;
- [ ] malformed dossier target/source/claim references;
- [ ] hostile same-ID official target URLs versus preserved source URLs;
- [ ] removed/reassigned catalog target;
- [ ] malformed comparison target order/outcome binding/evidence refs;
- [ ] reused dossier-local claim IDs across different Compare targets remain disambiguated by `targetKey`;
- [ ] malformed Guide submission/dossier/assessment evidence refs;
- [ ] Guide result with two competing refs survives round-trip with both refs;
- [ ] Guide context-rejected tuition/scholarship/application-fee evidence ref survives round-trip while remaining ineligible for deterministic conclusions;
- [ ] numeric/string coercion attempts;
- [ ] prototype-pollution-shaped keys remain inert/rejected by strict schemas;
- [ ] application-derived title boundaries and actual UTF-8 byte-size boundaries.

---

## Task 5 — Add a verified server identity helper

**Create:**
- `lib/auth/session.ts`
- `tests/phase6a-auth-session.test.ts`

**Modify if needed:**
- `lib/supabase/server.ts`

Requirements:

- [ ] Export one server-only helper with explicit assurance, e.g. `claims` for SSR identity/rendering and `auth-server` for private saved-artifact operations, returning only `authenticated { userId }`, `unauthenticated`, or sanitized infrastructure failure.
- [ ] Use current `getClaims()` guidance for cryptographically verified SSR identity; never authorize from `getSession().user` or request JSON.
- [ ] For every private saved-artifact list/get/save/delete operation, use the stronger current Auth-server validation path (`getUser()` under current Supabase guidance) before exposing or mutating private data; do not silently downgrade to `getClaims()` if the Auth service cannot confirm the request.
- [ ] Validate the final user ID as UUID before using it in persistence.
- [ ] Do not return access/refresh tokens to callers.
- [ ] Do not log raw auth errors/tokens/cookies.
- [ ] Treat missing/expired/invalid identity as unauthenticated; treat a server-confirmed logged-out/revoked user as unauthenticated; treat Auth-service validation failure as a sanitized infrastructure error.
- [ ] Document/test that `getClaims()` alone does not prove immediate server-side revocation: a still-unexpired signed JWT can remain locally valid. Do not claim instant global logout semantics from local claim validation.
- [ ] Keep user email out of authorization decisions.
- [ ] Create Supabase clients per request; never retain a user-scoped client/session in module scope where Vercel Fluid Compute could reuse it across users.

**RED cases:**
- [ ] no cookies;
- [ ] malformed/spoofed cookie;
- [ ] valid claim with missing/invalid `sub`;
- [ ] claim validation error;
- [ ] verified valid subject for SSR identity;
- [ ] Auth-server-confirmed current user for private API;
- [ ] Auth-server-confirmed signed-out/revoked user cannot access private API even if a locally supplied token shape appears otherwise valid;
- [ ] Auth-server outage does not fall back to weaker identity for private API and does not break anonymous Research/Compare/Guide;
- [ ] `getSession`-only fake user cannot authorize.

---

## Task 6 — Compose Supabase refresh into the existing CSP Proxy

**Create:**
- `lib/supabase/proxy.ts`
- `tests/phase6a-proxy-auth-csp.test.ts`

**Modify:**
- `proxy.ts`
- `lib/security/browser-policy.ts`
- `lib/env/public.ts` only if the existing public-env parser cannot provide one validated optional Supabase URL/origin without duplicating parsing logic.

Do not create `middleware.ts`.

Implementation sequence:

- [ ] Build request headers with the existing nonce/CSP exactly once.
- [ ] Extend the pure CSP builder with one optional application-owned Supabase connect origin. Derive it by parsing the configured `NEXT_PUBLIC_SUPABASE_URL` and emitting only `URL.origin`, never the raw environment string.
- [ ] Production accepts only an exact `https:` Supabase origin. Local Supabase tests may accept only the exact configured loopback `http:` origin required by the local CLI stack. Reject credentials, fragments, query strings, path-derived CSP text, unsupported schemes, malformed hosts, control characters, whitespace/token injection, wildcard hosts, and origin values that do not round-trip canonically.
- [ ] When optional auth/save configuration is absent, keep `connect-src` behavior identical to Phase 4/5: `'self'` plus only the existing development websocket source.
- [ ] When auth/save is configured, append exactly one validated Supabase origin to `connect-src`; never add `*.supabase.co`, generic `https:`, arbitrary caller URLs, or Tavily/Brave/Gemini/Groq/OpenRouter domains. Those Research providers remain server-only.
- [ ] Create a response/request-cookie bridge for Supabase SSR refresh that preserves the CSP-mutated request headers.
- [ ] Call verified claims/refresh once where required by current Supabase SSR guidance.
- [ ] When Supabase sets refreshed cookies, preserve every cookie option and every existing response header, especially CSP. With the current `@supabase/ssr ^0.12.4` line, also apply the cache-protection response headers supplied alongside `setAll` during refresh; never keep only the cookies and drop `Cache-Control`/`Expires`/`Pragma`, and never overwrite a stricter library-provided cache directive with a weaker one.
- [ ] Ensure downstream request cookies see refreshed values in the same request.
- [ ] Set/retain private/no-store behavior for authenticated/private pages where framework caching could otherwise reuse session-bearing content; regression-test a refresh response specifically for cross-user cache safety.
- [ ] Extend matcher only as needed so auth/private routes refresh while static assets remain excluded.
- [ ] Do not run expensive Research provider logic or database queries from Proxy.

**RED cases:**
- [ ] response has CSP but no auth cookies;
- [ ] response has auth cookies but CSP was accidentally dropped;
- [ ] request nonce differs from response nonce;
- [ ] multiple `Set-Cookie` values collapse into one;
- [ ] Supabase refresh cache-protection metadata is dropped/overwritten, allowing a session-bearing response to become cacheable;
- [ ] authenticated response from User A could be replayed/cached to User B;
- [ ] auth disabled/unconfigured -> no Supabase origin in `connect-src`;
- [ ] valid production Supabase URL -> exact HTTPS origin appears once and path/query/fragment do not;
- [ ] valid local Supabase URL -> only exact loopback HTTP origin appears in development/test;
- [ ] credential-bearing URL, protocol-relative value, `javascript:`, `data:`, wildcard/lookalike host, embedded whitespace/semicolon/control character, or malformed URL -> fail closed and cannot inject a CSP token;
- [ ] development websocket source remains present alongside the exact local Supabase origin;
- [ ] no search/AI provider hostname appears in browser `connect-src`;
- [ ] static asset unnecessarily refreshes auth;
- [ ] private route skips refresh;
- [ ] malformed session does not break anonymous page rendering;
- [ ] production CSP still excludes `unsafe-eval`/script `unsafe-inline`.

**Browser acceptance:** verify actual browser `Set-Cookie`, sign-in/save requests to only the configured local Supabase origin, normal navigation, Radix evidence dialog, and zero unexpected CSP/network violations. Add an external-request guard proving Research/search/AI provider domains remain absent from browser traffic even after Supabase connectivity is enabled.

---

## Task 7 — Implement passwordless auth routes/UI locally

**Create/modify exact paths after checking current layout conventions:**
- `app/auth/page.tsx` or `app/auth/sign-in/page.tsx`
- `app/auth/confirm/route.ts`
- `app/auth/sign-out/route.ts` or a server action owned by the auth module
- `components/auth/auth-session-provider.tsx`
- `components/auth/account-menu.tsx`
- `components/auth/sign-in-form.tsx`
- `components/layout/site-header.tsx`
- `app/layout.tsx`
- `lib/auth/redirects.ts`
- `tests/phase6a-auth-contracts.test.ts`
- `tests/e2e/auth-session.spec.ts`

Rules:

- [ ] Keep sign-in optional; Home/Research/Compare/Guide routes stay accessible signed out.
- [ ] Add one small root client Auth session provider that exposes only the minimum UI state (`loading`/`signed-out`/`signed-in`, current user UUID, optional display email) and subscribes to supported Supabase auth-state changes. Do not expose access/refresh tokens through React context and do not store the context state outside memory/cookies managed by Supabase SSR.
- [ ] Wrap the existing layout without disturbing the CSP nonce bridge, Tooltip provider, skip link, header/footer order, or server `connection()` behavior. `SiteHeader` consumes the auth state for Sign in/Account/Saved navigation without making the whole app auth-gated.
- [ ] Avoid hydration/account-data flash: initial unknown/loading state must not render a previous user's email or private actions; signed-out core navigation remains immediately usable.
- [ ] Email input is trimmed, length-bounded, syntactically validated, and never put in URL query/history.
- [ ] Use `signInWithOtp`/Magic Link with PKCE-compatible confirmation flow according to current official docs.
- [ ] Use one fixed application-owned post-auth destination or a closed internal-path allowlist. Never accept external/protocol-relative/backslash/encoded redirect destinations.
- [ ] Generic response after request regardless of account-existence outcome where feasible.
- [ ] Sanitize auth rate-limit/upstream errors.
- [ ] Callback validates token hash/type and never reflects token material.
- [ ] Successful auth redirects to an internal application page.
- [ ] Normal `Sign out` uses the current-session/local scope explicitly rather than Supabase's global default, so signing out of UniProof in one browser does not unexpectedly revoke every device. A future "sign out all devices" action is out of Phase 6A unless separately designed/tested.
- [ ] Signout clears private React state/view state and the memory-only restore handoff immediately; anonymous mode remains usable. Do not claim an already-issued JWT is cryptographically invalidated before its `exp`.
- [ ] Account menu exposes no raw user ID/token; email display, if used, is treated as private UI data and not logged.

**Local Mailpit E2E:**
- [ ] request valid invented magic link;
- [ ] extract test message only from local Mailpit/test channel, not OCR/manual secrets;
- [ ] complete callback;
- [ ] refresh/navigation retains signed-in state;
- [ ] local-scope logout returns the current browser to signed-out state while a second independent signed-in browser/session remains signed in;
- [ ] replay/expired/malformed link fails safely;
- [ ] no open redirect.

---

## Task 8 — Implement strict bounded private saved-artifact APIs

**Create:**
- `app/api/saved-artifacts/route.ts`
- `app/api/saved-artifacts/[id]/route.ts`
- `lib/persistence/server.ts`
- `lib/persistence/bounded-body.ts` if a reusable exact reader is justified
- `tests/phase6a-saved-artifacts-api.test.ts`

Do not refactor `/api/research` merely to share code unless the shared primitive can be proven behavior-identical with existing Research tests.

### `GET /api/saved-artifacts`

- [ ] current Auth-server-confirmed identity required;
- [ ] optional `kind` filter is a closed enum only; no caller limit/offset/cursor surface exists because an owner can have at most 20 rows;
- [ ] stable descending `(created_at,id)` order;
- [ ] return all owned metadata rows only, maximum 20; do not select/return multi-megabyte payloads in the list query;
- [ ] `Cache-Control: private, no-store` and no shared/static cache.

### `POST /api/saved-artifacts`

- [ ] same-origin/fetch-site mutation check;
- [ ] current Auth-server-confirmed identity required;
- [ ] `application/json` only;
- [ ] declared body ceiling checked but never trusted alone;
- [ ] actual request-stream maximum 4,300,000 UTF-8 bytes (below Vercel's current 4.5 MB Function request limit) and fatal UTF-8 decode;
- [ ] strict `kind`/`schemaVersion`/`payload` validation; reject caller `ownerId`, email, free-form title, target URL, and unknown keys;
- [ ] derive `owner_id` from the confirmed user and derive the bounded title from validated payload/current catalog;
- [ ] insert through a per-request user-scoped Supabase client so RLS remains active;
- [ ] map exact failures to the canonical persistence codes: unauthenticated, forbidden-origin, invalid-content-type, invalid-json/invalid-request, request-too-large/snapshot-too-large, snapshot-capacity-reached, snapshot-target-unavailable, or persistence-unavailable;
- [ ] no raw Auth/PostgREST/SQL/constraint text returned;
- [ ] never auto-retry POST after a transport disconnect/unknown completion. The client keeps Save single-flight and refreshes the Saved list before a user-initiated retry so a completed-but-unacknowledged insert does not become a blind duplicate.

### `GET/DELETE /api/saved-artifacts/[id]`

- [ ] exact UUID parse before database call;
- [ ] current Auth-server-confirmed identity plus user-scoped select/delete;
- [ ] missing and other-user row indistinguishable as `snapshot-not-found`;
- [ ] treat the selected DB row as untrusted persisted input: full row/payload/runtime invariant revalidation before response, then catalog-owned target rebinding where applicable;
- [ ] unknown snapshot version -> `snapshot-unsupported-version`; malformed/inconsistent row -> `snapshot-invalid`; catalog target removed/reassigned -> `snapshot-target-unavailable`;
- [ ] delete is exact one-row ownership operation;
- [ ] delete twice is safe/non-disclosing. If the first DELETE outcome was transport-ambiguous, refresh the list before claiming success or retrying; do not manufacture a success toast from a network error.

**RED/security cases:** cross-origin mutation, forged owner/title/target fields, invalid UTF-8, absent/dishonest Content-Length, request stream exactly 4,300,000 bytes/one byte over, payload exactly 4 MiB/one byte over, valid oversized Comparison -> neutral `snapshot-too-large` while in-memory result remains intact, connection abort before body complete, transport disconnect after DB mutation with unknown client outcome, Auth-server outage without weaker fallback, malformed/tampered own DB JSON, cross-user UUID, removed/reassigned target, unknown kind/version, direct owner-written schema-invalid row, and raw database error redaction.

---

## Task 9 — Add a Saved workspace without auto-loading private data into all modes

**Create:**
- `app/saved/page.tsx`
- `components/saved/saved-artifacts-workspace.tsx`
- `components/saved/saved-artifact-card.tsx`
- `components/saved/delete-saved-artifact.tsx`
- `components/saved/saved-restore-provider.tsx`
- `lib/persistence/client.ts`
- `tests/e2e/saved-artifacts.spec.ts`

**Modify:**
- `app/layout.tsx` to place `SavedRestoreProvider` inside the Auth session provider so it can clear on account changes/sign-out while preserving the existing nonce/UI provider structure.

Requirements:

- [ ] Signed-out `/saved` shows sign-in requirement without redirect loop and without breaking nav.
- [ ] Signed-in list loads the complete bounded metadata set in one request (maximum 20 rows) ordered descending by `(created_at,id)`; do not add pagination controls/state and do not prefetch multi-MiB payloads.
- [ ] Fetch a full artifact only when the user chooses Restore/Open.
- [ ] Add a memory-only restore handoff context containing only `{accountId, artifact}` plus a monotonic handoff token. It has `publish`, exact-kind `consume`, and `clear` semantics; `consume` clears the artifact exactly once. No URL/query/hash, Web Storage, IndexedDB, Cache Storage, service worker, or cookie restore channel.
- [ ] On Restore, capture current account ID + operation sequence before GET. After the await, discard the payload unless component is still mounted, account ID is unchanged, operation is still current, and response kind matches the requested artifact. Then publish and navigate to `/research`, `/compare`, or `/guide` as appropriate; profile restores navigate to Guide without auto-submission.
- [ ] Account change/sign-out clears the Saved list, any open private artifact, in-flight operation ownership, and restore handoff before new-account content renders.
- [ ] Clearly label saved time, artifact kind, and derived public title; do not claim the stored title is authoritative target identity.
- [ ] Deletion requires explicit per-item user action; no bulk delete in Phase 6A.
- [ ] Save/restore/delete mutations are client single-flight. If transport completion is ambiguous, show a neutral "outcome unknown" state and refresh the bounded list before the user retries; never auto-retry a mutation blindly.
- [ ] Preserve keyboard focus after delete/load error and after an outcome-unknown reconciliation.
- [ ] Loading an unsupported version, invalid/tampered row, or no-longer-supported target shows the corresponding bounded safe message and never publishes a restore handoff.
- [ ] No list/payload cache in browser persistent storage.

---

## Task 10 — Add explicit Save/Restore integration to Research

**Modify only after reading current workspace:**
- `components/research/research-workspace.tsx`
- `lib/research/mode/client-state.ts`
- relevant result/header component(s)
- `tests/e2e/research-evidence.spec.ts`
- focused Phase 6 Research save/restore lifecycle spec if separation improves readability

Requirements:

- [ ] Add the smallest explicit Research reducer action/state marker needed to install a validated restored result while **not loading**. Do not mutate reducer state directly from components. The restored state carries the reconstructed immutable `ResearchSubmissionSnapshot` plus a visible `Saved snapshot loaded.` notice, but does not pretend the dossier came from the current network run.
- [ ] Reconstruct the submission only from the validated dossier/public Research fields and current catalog label. Never trust a saved title or saved official target URL for `targetLabel`, target identity, or a future request.
- [ ] Consume only an exact `research` memory restore handoff for the current account and clear it once. If an active Research request exists, starts before restore replacement completes, or owns a newer sequence, discard/defer the restore rather than overwriting the run.
- [ ] Before replacing a displayed Research result, close the selected claim/evidence trigger. If an animation-frame/presentation await is used, re-check mounted state, current account, restore token/sequence, and `activeRequestRef` afterward before dispatching the restored result.
- [ ] Save control appears only for the **current finalized displayed Research result** and an authenticated user; signed-out user may see a non-blocking sign-in-to-save affordance. Disable Save during an active run so a preserved previous result cannot be accidentally saved as though it were the in-flight update.
- [ ] Saving captures the exact dossier + immutable submission/account at click time. Saving never changes Research lifecycle, retry eligibility, evidence status, or cancellation ownership. If account/result ownership changes while POST is in flight, do not show a success message against the newer state even if the original DB insert completed correctly.
- [ ] Save failures or outcome-unknown transport failures leave the current result intact; never auto-retry the mutation.
- [ ] Restored Research dossier is visibly historical (`Saved snapshot`) and must not enter any current-session Research reuse/cache path automatically.
- [ ] Use the shared catalog binder before presentation; removed/reassigned targets fail restore, current official university/program URLs come only from catalog, and every source/evidence URL remains dossier-owned.
- [ ] Refresh from saved snapshot constructs a **new normal Research submission** from validated university/program/categories/intake/academicYear fields and enters the existing `startSubmission` path. Never send stored source URLs, evidence text, provider history, or private metadata as request inputs.
- [ ] A failed/cancelled Refresh from a saved snapshot preserves that saved snapshot as the prior result exactly as the existing Research reducer preserves prior current results.
- [ ] Saved partial dossiers remain visibly partial; stale/outdated/conflicting/incomplete evidence remains exactly that and is never promoted during restore.

**RED cases:** save while loading; save after stale result replacement; account switch/signout during save; save POST completion after a newer Research result; ambiguous POST completion; oversized valid dossier save failure; hostile stored official target URL; removed/reassigned target; source URL accidentally rebound; evidence sheet open during restore; delayed restore GET after a new Research run starts; restore consume twice; restored stale/outdated/conflicting claim promoted; refresh failure/cancel loses restored prior result.

---

## Task 11 — Add explicit Save/Restore integration to Compare

**Modify:**
- `components/compare/compare-workspace.tsx`
- `components/compare/*` only as required for the Save/Saved-snapshot affordance
- `lib/comparison/client-state.ts`
- `lib/comparison/*` only for the exact version-1 runtime snapshot schema/internal-consistency validator
- current Compare security/state/evidence E2E suites plus a focused Phase 6 comparison-save/restore spec

Requirements:

- [ ] Add the smallest reducer action needed to install one validated historical `ComparisonResult` while no batch is loading, with a visible Saved-snapshot notice. A delayed restore must never overwrite an active/newer batch.
- [ ] Consume only an exact `comparison` restore handoff for the current account, exactly once. Capture account + handoff token before replacement; close current evidence selection first and re-check account/token/active batch after any presentation await.
- [ ] Save only the finalized **current** `ComparisonResult`; disable Save during loading. Preserve target selection order, exact weights/categories/display filters, outcomes, score/coverage/suppression, trade-offs, and every target-scoped evidence ref.
- [ ] Version-1 restore performs strict structural/internal consistency validation: every outcome target belongs to the immutable submission in the same order, dossier targets match their outcome target, score rows/coverage target keys and dimensions belong to the submission, trade-off/evidence refs resolve to the correct target/dossier claim, and no missing/duplicate target outcome is accepted. Do not silently recompute and overwrite the historical score/trade-offs under current logic merely to validate a saved snapshot.
- [ ] Future comparison logic changes require a new snapshot version/adapter rather than retroactively reinterpreting version 1. In version 1, malformed/internally inconsistent stored score/trade-off data fails `snapshot-invalid` instead of being repaired.
- [ ] Bind each restored dossier's application-owned target navigation through the shared current-catalog binder. If any selected target was removed/reassigned, fail restore with `snapshot-target-unavailable`; preserve evidence/source URLs.
- [ ] Restored results never auto-rescore or refetch providers. They remain historical until the user explicitly chooses Re-run.
- [ ] Explicit Re-run creates a new immutable comparison submission from validated stored public inputs and enters the existing sequential `runBatch` path. Re-run must re-check the current catalog and cannot bypass `unsupported-target` correction. The historical restored result remains the reducer `previous` result so cancellation/failure preserves it.
- [ ] A saved/restored unsupported-target transport outcome remains non-retryable under the existing retry derivation; restore must not convert it into a retry candidate.
- [ ] Save completion after account/result change cannot display success against the newer result. Save failure/outcome-unknown/oversize never mutates or clears the comparison result.

**RED cases:** reused dossier-local claim IDs across targets; duplicate/missing/reordered outcome; outcome/dossier target mismatch; score target/dimension outside submission; malformed target-scoped trade-off ref; removed/reassigned target; stored hostile official URLs but preserved source URLs; unsupported-target becoming retryable; save completion after newer batch; account switch/signout during Save/Restore; restored result followed immediately by a new batch; evidence sheet open during replacement; Re-run failure/cancel loses historical prior result; oversized save failure; malformed version-1 score/result is silently repaired instead of rejected.

---

## Task 12 — Add explicit Save/Restore integration to Guide and profile opt-in

**Modify:**
- `components/guide/guide-workspace.tsx`
- `components/guide/*` only as required for Save/Saved-snapshot/profile affordances
- `lib/guide/client-state.ts`
- `lib/guide/contracts.ts` for the exact version-1 runtime `GuideResult` snapshot schema if Task 4 did not already place it there
- `tests/e2e/guide-lifecycle.spec.ts`
- the current Guide security/privacy/evidence suites
- focused saved-Guide/profile browser spec

Requirements:

- [ ] Anonymous profile behavior remains browser-memory-only. `Save profile` is a separate explicit authenticated action with a concise notice that citizenship/current-country/qualification/GPA/English/budget/scholarship fields will be stored privately in the account.
- [ ] `Save Guide result` is a separate explicit action and is explicit consent to persist the contained immutable applicant submission/profile snapshot. Account email/user ID is never copied into Guide profile/submission fields.
- [ ] Consume only `profile` or `guide` handoffs for the current account, exactly once. Loading a profile populates validated profile fields only; it never auto-selects a target, auto-submits, calls Research, or invents a new assessment date/result.
- [ ] Add the smallest reducer action needed to install a validated historical Guide result while no assessment is loading. Before replacement, call the existing `closeEvidenceBeforeReplacement()` path; **after its RAF await**, re-check mounted state, current account, restore token/sequence, `activeRunRef`, and any new assessment ownership before dispatch. This explicitly preserves the Phase 5 cancellation-after-await fix.
- [ ] A restored Guide result preserves its original `assessmentDate`, immutable public target/intake/year context, `researchRequest`, dossier, complete/partial status, all six requirement states, budget assessment, risks, checklist, timeline, unrecognized/manual evidence, and **every** evidence ref array. Do not recompute or collapse refs on restore.
- [ ] The restored historical dossier must **not** seed or replace `reusableDossier`. Current-session dossier reuse remains available only for dossiers obtained through the normal Guide Research path. Therefore a profile change after restoring a Guide result cannot silently assess against saved historical evidence as though it were current-session reusable research.
- [ ] `Reassess`/`Refresh evidence` from restored state is explicit and enters the existing normal Guide lifecycle. It must perform a new Research request when the only available dossier came from persisted history; then `finalizeGuideResult` rechecks target, intake, academicYear, exact Guide categories, catalog identity, and usable dossier status before current conclusions are published.
- [ ] Bind restored application-owned target navigation from the current catalog; removed/reassigned target -> `snapshot-target-unavailable`. Preserve source/evidence URLs exactly.
- [ ] Preserve the current closed semantic registry and deterministic evidence gates after round-trip: ASCII-only whitespace alias normalization, reviewed singleton aliases only, same-scale GPA, same-test English, exact currency/scope/period, context-rejected evidence retained for inspection but not conclusions, and amount-neutral application-fee review when period metadata is missing/mismatched.
- [ ] Preserve all competing evidence buttons/refs after restore. A Guide result containing two conflicting GPA refs must still render two exact evidence triggers; context-rejected tuition/scholarship/application-fee refs remain inspectable.
- [ ] The provider non-transmission marker test must prove restored/saved profile values never appear in `/api/research`, source retrieval, or browser requests other than the intended private Supabase save boundary. Profile values must not leak into URL/history/logs/console.
- [ ] Save is disabled during an active assessment/refresh so `state.previous` cannot be mislabeled as the current result being saved. Save completion after newer state/account change cannot display success against that newer state.

**RED cases:** signout/account switch during assessment, Save, Restore, or evidence-sheet interaction; delayed restore after a new assessment starts; cancellation during `closeEvidenceBeforeReplacement()` await; saved historical dossier accidentally becomes `reusableDossier`; profile-only edit after restore silently reuses saved dossier; intake/year mismatch bypasses finalizer on Reassess; restored result date rolls to today; two competing refs collapse to one; context-rejected fee/tuition/scholarship ref disappears or becomes eligible; amount from context-rejected fee appears as current; hostile stored official target URL; source URL rewritten; stored hostile evidence text/XSS; applicant marker enters Research/provider request; save after cancellation/stale previous result; removed/reassigned target; partial restored Guide presented as complete.

---

## Task 13 — Auth/private accessibility, responsive, CSP, and privacy acceptance

**Create:**
- `tests/e2e/auth-accessibility.spec.ts`
- `tests/e2e/saved-responsive.spec.ts`
- `tests/e2e/auth-privacy.spec.ts`

Cover existing viewport matrix where relevant: 320x740, 375x812, 390x844, 768x1024, 1024x768, 1440x900.

- [ ] login form labels, instructions, errors, pending/sent state, aria-live behavior, deterministic focus movement, and keyboard submit;
- [ ] magic-link sent/error/replay states keyboard accessible without exposing the email/token in URL-visible UI;
- [ ] account menu Sign in/Saved/Sign out controls keyboard accessible with correct focus dismissal and no previous-user flash;
- [ ] desktop and mobile header remain usable when account/Saved affordances are added; no horizontal overflow or inaccessible hidden-only account action;
- [ ] Saved bounded list, Restore, Delete confirmation, outcome-unknown reconciliation, empty/error states, and focus restoration are keyboard accessible;
- [ ] server-derived long Unicode public titles and long target labels wrap without overflow at all tested viewports;
- [ ] full 20-item Saved list remains usable at mobile widths without adding pagination state;
- [ ] reduced-motion behavior remains correct during auth/list/restore result transitions;
- [ ] no profile/email/token/artifact/restore markers in query/hash/history/localStorage/sessionStorage/IndexedDB/Cache Storage/service-worker state;
- [ ] the memory-only restore handoff disappears after exact consume, account change/signout, or full reload and cannot be consumed by a different artifact kind;
- [ ] expected Supabase SSR cookies only; do not assert unsupported `HttpOnly` semantics for standard rich-client Supabase SSR;
- [ ] CSP `connect-src` contains only `'self'`, the exact configured local Supabase origin, and the existing exact dev websocket when applicable. No wildcard Supabase, generic `https:`, or Tavily/Brave/Gemini/Groq/OpenRouter browser origins;
- [ ] auth refresh response preserves nonce CSP and Supabase cache-protection headers; no CSP console violations or cross-user cacheable session response;
- [ ] no provider credentials/private snapshot values in client bundle, console, page errors, Playwright trace/screenshot artifacts, or public URLs;
- [ ] XSS-shaped persisted title/profile/evidence text remains inert React text; stored title is never used as raw HTML or target/navigation authority;
- [ ] no unexpected third-party browser requests beyond intentionally configured Supabase Auth/Data API origin for authenticated account/save functionality. Research/search/AI providers remain server-side;
- [ ] applicant profile marker is observed only in intended in-memory UI/private Supabase save payload when Save is explicitly invoked, and never in `/api/research`, source URLs, browser logs, or provider-bound surfaces.

---

## Task 14 — Session/race/RLS/adversarial persistence matrix

**Create:** `tests/e2e/auth-ownership-lifecycle.spec.ts`

Run the high-risk suite at least five times with configured retries zero. Use two invented local users and isolated browser contexts where cross-account behavior is required.

Cases:

- [ ] User A opens Saved -> session changes to B -> A rows/open artifact/restore handoff disappear **before** B rows render;
- [ ] A's in-flight list or artifact GET completes after switch to B -> stale A response discarded and cannot publish a B-consumable handoff;
- [ ] A publishes a restore handoff, then account switches to B before destination consumes -> handoff cleared and B cannot consume A payload;
- [ ] a delayed Research/Compare/Guide restore GET completes after the destination has started a newer run -> historical restore cannot overwrite that run;
- [ ] Guide restore replacement is cancelled/account-switched during `closeEvidenceBeforeReplacement()` RAF await -> no stale result/evidence trigger publishes after the await;
- [ ] A's in-flight save completes after local signout/account change -> database row, if committed, remains A-owned; UI does not claim save success for B/anonymous and list reconciliation reveals the truth only when A signs in again;
- [ ] POST/DELETE transport completion is ambiguous -> no automatic mutation retry; list reconciliation occurs before the user can retry/receive definitive success;
- [ ] signout during delete -> no cross-user fallback or fabricated success;
- [ ] token refresh during Save/GET/Delete preserves the same user ownership and all Supabase cache-protection headers;
- [ ] Auth-server validation outage -> private API returns sanitized `persistence-unavailable`/auth infrastructure outcome and **does not** fall back to `getSession()`/claims-only authorization; anonymous Research/Compare/Guide remain usable;
- [ ] local-scope logout signs out one browser/session while a second independent signed-in session remains signed in. Do not assert that the first access JWT becomes invalid before expiry;
- [ ] subsequent app-owned private API from the logged-out browser is rejected because `getUser()` no longer confirms a current user;
- [ ] direct Data API threat model is exercised separately: a user token can access only its own rows under RLS and cannot cross-user read/delete/insert; if the owner directly creates a schema-invalid/tampered **own** JSON row that still satisfies SQL constraints, UniProof GET/Restore rejects it as `snapshot-invalid` rather than trusting RLS as content integrity;
- [ ] direct cross-user UUID probes through app API all return non-disclosing `snapshot-not-found` behavior;
- [ ] forged owner/title/body fields rejected before DB or by grants/RLS;
- [ ] 20-row capacity race cannot create 21 rows under concurrent authenticated saves;
- [ ] direct UPDATE is denied by both table privilege and absence of UPDATE policy;
- [ ] malformed/removed target own-row cannot restore using stored official URLs;
- [ ] memory restore handoff cannot be consumed twice or by the wrong artifact kind;
- [ ] app remains usable anonymously after local Supabase service is stopped/unavailable, except account/save features. Missing optional Supabase configuration must not break the anonymous production build/core routes.

---

## Task 15 — Full Phase 0–6A regression and security verification

Run on the **final** Phase 6A source after all focused fixes. Record observed counts rather than copying stale expected numbers.

Database/local platform:

- [ ] `supabase db reset` local only;
- [ ] `supabase db lint`;
- [ ] run the installed CLI's DB advisor command discovered via `--help`, fix relevant findings, and record any proven-inapplicable advisory;
- [ ] `supabase test db` including grants + RLS + capacity/concurrency tests;
- [ ] local Auth/Mailpit flows use invented accounts only; no hosted project link/config exists.

Static/unit/build:

- [ ] full `npx vitest run`. The pre-Phase-6A reviewed baseline was **457/457**; all of those prior tests must remain green in addition to new Phase 6A tests. Do not weaken/remove an existing regression to satisfy new code;
- [ ] `npx tsc --noEmit`;
- [ ] `npx eslint .`;
- [ ] `npx next build` with optional Supabase configuration absent to prove anonymous core build/degrade behavior;
- [ ] production build/test with local Supabase configuration present for authenticated paths;
- [ ] `npm audit --omit=dev`;
- [ ] `npm ci --dry-run --ignore-scripts`;
- [ ] workspace verifier;
- [ ] CRLF-aware `git diff --check`;
- [ ] UTF-8/control-character scan over touched/new text files.

Browser/lifecycle:

- [ ] full development Playwright Research + Compare + Guide + Auth/Saved. Preserve the reviewed pre-6A Research **67**, Compare **55**, and Guide **50** behavioral cases; those existing suites must remain green plus the new auth/persistence/restore suites;
- [ ] explicitly rerun the existing Research hostile-official-link regression, Compare security/evidence/state suites, and Guide evidence/privacy/security/lifecycle suites after the shared catalog binder/restore integrations;
- [ ] Guide lifecycle existing suite repeated at least 5x with retries zero, including the Phase 5 cancel-during-post-response-await regression;
- [ ] new auth/ownership/restore lifecycle suite repeated at least 5x with retries zero;
- [ ] full built-production Playwright using the documented Windows-host environment form from the CodexPro WSL shell, including Auth/Saved against the local Supabase stack where the harness supports it. If a built-mode auth check cannot be exercised because of a verified environment limitation, keep dev/local-auth evidence separate and do not call it built/live verification.

Security/privacy/integrity:

- [ ] production client-boundary scan;
- [ ] browser CSP scan proving only exact Supabase origin + allowed dev websocket additions and no search/AI provider browser origins;
- [ ] provider-key-name and configured-secret-value scans without printing values;
- [ ] scan that `SUPABASE_SERVICE_ROLE_KEY` is absent from browser/client dependency graph and ordinary private API code;
- [ ] scan source/test artifacts for access/refresh tokens, auth cookies, invented private profile markers, `.env` contents, DB connection strings, and Mailpit message bodies before retaining artifacts;
- [ ] prove memory-only restore state is absent from local/session storage, IndexedDB, Cache Storage, service workers, and URL state;
- [ ] verify catalog binder preserves evidence/source URLs and all target-scoped refs;
- [ ] verify own-row tampering is rejected by app restore while cross-user RLS remains denied;
- [ ] inspect protected screenshot count/hash if a known baseline is available; otherwise prove no write/delete target touched `ui-flow-screenshots/`;
- [ ] inspect final Git status/diff and ensure only intended Phase 6A + pre-existing approved changes exist; nothing staged unless the user separately asked for Git action.

Do not claim hosted Supabase, real cross-device, Preview/Production, CI-remote, or live-provider verification; this batch is local Supabase only.

---

## Task 16 — Main-agent two-pass final review and documentation synchronization

**ZERO SUBAGENTS.** GLM-5.3 Max performs both review passes itself after implementation and verification. Do not invoke a reviewer/code-reviewer/security specialist/accessibility agent or any delegated process.

### Pass 1 — requirements/security/invariant review

Review the actual final diff against the canonical Phase 6A plan and every preserved Phase 3–5 invariant. Defect-first, not summary-first:

- [ ] Auth/session: optional anonymous core, PKCE callback/open-redirect handling, explicit local-scope signout, current Auth-server validation for private API, no token exposure/context, no false instant-revocation claim, no module-scoped user client.
- [ ] Proxy/CSP/cache: one Next.js Proxy only, nonce/CSP unchanged in principle, exact Supabase `connect-src`, refreshed cookies + Supabase cache-protection headers preserved, no cross-user cache path, no provider browser origins.
- [ ] Database: migration reproducibility, table grants **and** RLS, owner predicate, no UPDATE, capacity race, payload byte constraints, trigger/function privilege/search_path/advisory-lock correctness, no unnecessary SECURITY DEFINER/service role.
- [ ] API: bounded streamed body, strict UTF-8/JSON/schema parsing, exact error vocabulary, current identity, no owner/title trust, no raw DB/Auth errors, untrusted DB-row revalidation, no blind non-idempotent mutation retry.
- [ ] Restore/history: memory-only cross-route handoff, exact account/kind consume, operation sequences, no stale overwrite, current catalog official-link binding, source URL preservation, target unavailable fail-closed, historical freshness labels, no automatic rescore/reassess/provider call.
- [ ] Research lifecycle: prior-result preservation, immutable submission reconstruction, evidence sheet close/ownership, no saved snapshot promoted to current response/reuse.
- [ ] Compare lifecycle: immutable target order/outcome binding, target-scoped refs, unsupported-target non-retry behavior, historical result preserved on rerun failure/cancel, no silent score repair/recompute.
- [ ] Guide lifecycle: intake/year/categories/target finalizer binding, saved dossier never seeds `reusableDossier`, cancellation re-check after presentation await, all competing/context-rejected refs preserved, closed aliases/same-scale/exact-currency rules intact, partial remains partial.
- [ ] Privacy/accessibility/responsive: explicit profile-save consent, account identity not applicant profile, provider non-transmission, no persistent browser private state, no previous-user flash, keyboard/focus/mobile/long-content behavior.
- [ ] Fix every substantive finding regression-first, then rerun the focused affected suite and the complete final gates.

### Pass 2 — fresh defect/complexity review

Approach the green implementation as if reviewing someone else's patch, still in the same main agent:

- [ ] Trace each new write/read/restore path source-to-sink and look for races, stale ownership, confused-deputy behavior, missing await checks, ambiguous mutation outcomes, inconsistent error mapping, and cache/session leakage.
- [ ] Look for accidental architecture duplication: duplicate catalog binders, multiple auth/session stores, multiple restore channels, duplicated schema validators, service-role shortcuts, generic persistence frameworks, pagination despite 20-row cap, unnecessary dependencies, or speculative abstractions.
- [ ] Check whether any Phase 6A code silently implements Phase 6B/6C work such as hosted linking, deployment, WAF, live providers, production SMTP, CI publication, or external resource mutation. Remove/defer such scope creep.
- [ ] Inspect generated/local Supabase files and final Git diff for secrets, local credentials, test messages, unrelated formatting/cleanup, protected screenshot changes, or accidental user-owned modifications.
- [ ] Repeat full relevant verification after final fixes; do not rely on an earlier green run after changing code/docs.

### Docs to update from observed implementation only

- [ ] `docs/planning/phase-6-hardening-submission-readiness.md` Phase 6A status/evidence;
- [ ] `docs/superpowers/plans/2026-08-19-phase-6a-identity-persistence.md` implementation/audit notes only where observed behavior materially changes the plan;
- [ ] `docs/planning/tasks.md`;
- [ ] `docs/requirements.md`;
- [ ] `docs/design.md`;
- [ ] `docs/security.md`;
- [ ] `docs/security-threat-model.md`;
- [ ] `README.md` only if local setup/usage actually changed;
- [ ] `CHANGELOG.md`;
- [ ] `AGENT_MEMORY.md` with exact observed counts/boundaries;
- [ ] `LESSONS.md` only for genuinely reusable corrections.

### Implementation completion record — 2026-08-19

Phase 6A is locally complete after the stopped GLM-5.3 Max thread was reviewed and finished in the main ChatGPT agent with **zero subagents**. Observed final evidence: Vitest **508/508**; TypeScript/ESLint/Next.js 16.3.1 build pass; `npm audit --omit=dev` **0 vulnerabilities**; `npm ci --dry-run --ignore-scripts` pass; workspace verifier pass; local Supabase reset/lint/advisors pass; pgTAP **40/40**; development Playwright Research **67/67**, Compare **55/55**, Guide **50/50**, Auth/Saved **7/7**; Guide lifecycle five-repeat **55/55** with retries zero; Auth/Saved seven-case five-repeat **35/35** with retries zero; built-production anonymous/core Research **67/67**, Compare **55/55**, Guide **50/50**. Authenticated built-mode against local HTTP Supabase is not claimed because the production CSP correctly refuses an HTTP `NEXT_PUBLIC_SUPABASE_URL`; hosted HTTPS Auth verification belongs to Phase 6C.

Defect-first review fixes included: Research snapshots now retain the exact public request needed for explicit refresh; PostgREST `timestamptz` offsets parse correctly; private-body failure cancellation is non-blocking; Magic Link callback redirects preserve the exact browser origin; local callback completion waits for server-confirmed session establishment; private mutation CSRF checks prefer browser-owned Fetch Metadata over internally canonicalized host text; current-session signout is a same-origin server route; missing-session Auth errors map to unauthenticated rather than false infrastructure failures; saved-list Strict Mode ownership is stable; independent pre-assessment **Save profile** is supported without Research; qualification title/subject errors map to exact form fields; and thrown Auth transport errors fail closed through sanitized responses.

Security/integrity review observed no service-role usage in ordinary Auth/Persistence/Supabase private runtime paths, no provider key-name exposure in `app/`/`components/`, no retained hard-coded JWT/database/Supabase-secret literals, and no UTF-8/trailing-whitespace/control-character findings across the active repository text scan. The Supabase CLI generated local secret material only under ignored `supabase/.temp`; it is not part of the commit. The ten protected `ui-flow-screenshots/` PNGs were not modified or deleted.

**Stop condition:** Phase 6A ends with a locally reproducible, tested auth/RLS/persistence implementation and a clean main-agent two-pass review. Do **not** link/push a hosted Supabase project, deploy Vercel, mutate GitHub, send live provider requests, publish/submit anything, or commit/push unless the user separately authorizes that exact action.
