# Phase 6 — Hardening and Submission Readiness

Status: **Phase 6A and Phase 6B implemented and locally verified** as of 2026-08-20; Phase 6C remains external/release work. Local Supabase Auth/Mailpit, migration/RLS, private saved-artifact APIs, explicit save/restore, the 240-second Research execution budget, host-cancellation configuration, deployment 429/504 handling, Gemini stable-v1 transport, release verification, and least-privilege CI are implemented. No hosted Supabase mutation, Vercel project/WAF change, deployment, live provider request, actual GitHub Actions run, or Devpost submission is claimed by Phase 6B.

Detailed execution plans:

- `docs/superpowers/plans/2026-08-19-phase-6a-identity-persistence.md`
- `docs/superpowers/plans/2026-08-19-phase-6b-production-hardening.md`
- `docs/superpowers/plans/2026-08-19-phase-6c-deployment-submission.md`

## 1. Objective

Phase 6 converts the locally acceptance-complete Phase 0–5 MVP into a release-ready hackathon application without weakening UniProof's evidence, privacy, cancellation, or provenance guarantees.

Phase 6 is deliberately split into three dependency-ordered batches rather than one monolithic implementation:

1. **Phase 6A — Identity, ownership, and persistence:** optional Supabase authentication, server-derived ownership, reproducible local migrations/RLS, explicit saved snapshots, and cross-device private state.
2. **Phase 6B — Production hardening:** bounded whole-run execution, durable/deployment-layer abuse protection, production security configuration, CI, traceability, and release gates.
3. **Phase 6C — Deployment and submission:** separately authorized hosted Supabase/Vercel changes, production verification, bounded live smoke, release screenshots/demo assets, and separately authorized Devpost submission.

A later batch may not bypass an earlier batch's completion gate. External actions remain separately authorization-gated even when the corresponding implementation plan is otherwise approved.

## 2. Baseline

The starting baseline for this plan was the reviewed Phase 0–5 working tree recorded in `AGENT_MEMORY.md` on 2026-08-19. Phase 6A has since been layered onto that baseline without changing the established Research/Compare/Guide evidence semantics:

- Research still uses the hardened same-origin `/api/research` boundary and validated public `ResearchDossier`.
- Compare still consumes 2–4 validated dossiers sequentially and scores through a closed deterministic registry.
- Guide still sends only public target/intake/year context to Research; applicant data remains provider-separated.
- Production CSP still uses request nonces and no third-party runtime analytics/scripts.
- Phase 6A now adds Supabase SSR Auth refresh, local migration/RLS, strict private saved-artifact APIs, and optional explicit profile/Research/Comparison/Guide snapshot persistence.
- Public deployment remains blocked on durable abuse limiting, host duration/cancellation behavior, production secrets/domain/TLS/HSTS, hosted Auth/RLS/email verification, and live smoke.

Do not rewrite Phase 2–5 evidence semantics during Phase 6. Phase 6 is a hardening/release phase, not a new AI reasoning phase.

## 3. Non-negotiable invariants

The following remain true throughout Phase 6:

1. **Anonymous core product remains usable.** A judge must be able to use Research, Compare, and Guide without creating an account. Authentication adds private save/history capability; it does not become a prerequisite for the core demo.
2. **Applicant privacy remains provider-separated.** Citizenship/current country, qualification, GPA, English-test results, budget, scholarship need, account identity, and saved private state must never enter `/api/research`, Tavily, Brave, Gemini, Groq, OpenRouter, arbitrary source retrieval, provider telemetry, or public URLs.
3. **No new Guide/Compare AI endpoint.** Phase 6 does not add `/api/guide`, `/api/compare`, applicant-aware provider prompts, admission probability, or AI scoring.
4. **Evidence semantics remain deterministic.** Saved or deployed state cannot widen the closed Compare/Guide registries, invent values, select conflict winners, perform hidden conversion, or turn stale/unknown/incomplete evidence into current evidence.
5. **Saved results are immutable snapshots, not freshness claims.** Loading a saved result must label its saved/retrieved time and must not silently reuse it as current Research evidence. Refresh is an explicit new Research run.
6. **Catalog owns official target navigation.** Persisted/reloaded dossiers must still bind application-owned university/program URLs to the current checked-in catalog; dossier sources retain evidence-link ownership.
7. **Server derives ownership.** No API, Server Action, database function, or RLS policy trusts caller-supplied `userId`, `ownerId`, email, or JWT claims copied into request JSON.
8. **No browser Web Storage for credentials/private snapshots.** Do not store auth/session/JWT/refresh tokens, applicant profiles, saved dossiers, or saved results in `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, service workers, or URL/query/hash state.
9. **Supabase SSR claims are represented truthfully.** Use the current supported `@supabase/ssr` cookie-based PKCE model and server `getClaims()`/equivalent verified identity path. Do not claim the standard rich-client Supabase SSR cookies are `HttpOnly`: current Supabase guidance requires browser access to session cookies for its browser session lifecycle. Mitigate this residual exposure with strict CSP, no third-party runtime scripts, Secure/appropriate SameSite production cookies, server-side authorization, short-lived access tokens/provider defaults, and zero private database access that trusts an unverified browser identity object. If the implementation deliberately replaces this with a custom server-only HttpOnly session architecture, that is a new architecture decision requiring a fresh plan/security review rather than an incidental change.
10. **No service-role key in ordinary user paths.** User CRUD should use the authenticated user-scoped Supabase client and RLS. `SUPABASE_SERVICE_ROLE_KEY` is not required for normal save/list/delete operations and must not be introduced into client code, ordinary request handling, fixtures, logs, or CI.
11. **External mutation is explicit.** Hosted Supabase linking/migration/Auth settings, Vercel project/env/domain/firewall/deploy changes, GitHub remote mutations, live provider calls, and Devpost submission require the explicit authorization defined in `AGENTS.md`.
12. **Protected screenshots remain protected.** `ui-flow-screenshots/` is not the Phase 6 release-screenshot output directory and must not be overwritten or deleted.
13. **Browser connectivity remains closed.** The existing CSP continues to allow browser connections only to application-owned destinations. When optional Supabase Auth/save is configured, `connect-src` may add only the exact validated origin derived from `NEXT_PUBLIC_SUPABASE_URL` plus the existing development websocket exception. Never add `*.supabase.co`, arbitrary caller/provider URLs, Tavily/Brave/Gemini/Groq/OpenRouter domains, or a generic `https:` source. Invalid/credential-bearing/path-confused Supabase configuration fails closed instead of becoming CSP text.

## 4. Phase 6A architecture — identity, ownership, persistence

### 4.1 Authentication UX

Authentication is optional. Add a compact account entry point without moving Research/Compare/Guide behind an auth wall.

Planned initial sign-in method: **Supabase passwordless email Magic Link using PKCE**, because the application does not need to own password storage/reset semantics. Use a generic post-request response so the UI does not disclose whether an email already has an account. Configure exact Site URL and redirect allowlists; reject caller-controlled redirect destinations.

Local implementation must use Supabase CLI local Auth and Mailpit/Mailpit-equivalent local capture only. Production email/SMTP configuration is a Phase 6C external gate. If production email delivery is not demonstrably configured, authentication/save UI must not be presented as production-ready; anonymous core functionality remains deployable.

Required auth states:

- signed out;
- magic-link request pending/sent;
- malformed/expired/replayed token;
- successful callback;
- signed in;
- refresh success/failure;
- signed out in current tab;
- session expired/revoked;
- account switched while a private page is open;
- Supabase temporarily unavailable.

Do not expose raw Supabase errors, token hashes, access tokens, refresh tokens, or email existence.

### 4.2 One Proxy, two responsibilities

The existing root `proxy.ts` owns CSP nonce generation. Phase 6A must **compose Supabase session refresh into that same Next.js 16 Proxy** rather than introducing a conflicting `middleware.ts` or a second proxy layer.

The composition must preserve:

- the exact request nonce/header delivered to server rendering;
- the matching response CSP header;
- every Supabase `Set-Cookie` generated by session refresh;
- request cookies updated for downstream Server Components;
- existing static/prefetch exclusions where compatible;
- explicit inclusion of routes that need auth refresh;
- no caching of responses carrying user-specific session state or `Set-Cookie`. The current dependency line uses `@supabase/ssr ^0.12.4`; current Supabase SSR guidance for releases >=0.10 passes cache-protection headers as metadata to the cookie `setAll` callback during refresh. The implementation must apply/preserve those returned cache headers (`Cache-Control` and related headers) together with refreshed cookies and CSP rather than copying cookies alone or overwriting them with a weaker cache policy;
- the current strict `connect-src 'self'` posture, widened only when optional Supabase browser auth/save is configured to the **single exact Supabase origin** parsed from `NEXT_PUBLIC_SUPABASE_URL`. Production accepts an exact HTTPS origin; local Supabase tests may accept their exact loopback HTTP origin. Strip/reject credentials, path/query/fragment influence, unsupported schemes, malformed hosts, and any value that cannot round-trip through `URL.origin`. Never add a Supabase wildcard or any Research/search/AI provider domain to browser CSP.

Regression tests must prove that auth refresh cannot erase CSP, CSP cannot erase refreshed cookies, one user's refreshed response cannot be cached/replayed to another user, and the browser can reach only the exact configured Supabase origin required for Auth/save while unexpected external/browser provider requests remain blocked.

### 4.3 Verified identity helper

Create one server-only identity helper with an explicit assurance level instead of treating every Supabase auth method as equivalent. Current Supabase guidance recommends `auth.getClaims()` to cryptographically validate claims for pages/user data, but its advanced guidance also states that `getClaims()` validates token signature/expiration locally and does **not** contact Auth to prove that a server-side logout/revocation has already occurred. Use `getClaims()` for normal SSR identity/render decisions; use the server-confirming `auth.getUser()` path for every private saved-artifact read/write/delete where the project wants current Auth-server session validity before exposing or mutating private profile/result data. Return only the minimum application identity required for ownership, normally the authenticated user UUID.

Rules:

- never authorize from `getSession().user` alone;
- never authorize from a client-provided user ID/email;
- validate the final user ID as a UUID before database use;
- treat missing/invalid/expired claims as unauthenticated;
- for private saved-artifact API operations, treat `getUser()` unauthenticated/revoked results as unauthenticated and Auth-service validation failures as sanitized infrastructure failures; do not silently fall back to weaker client/session data;
- document the JWT residual accurately: a cryptographically valid access token can remain locally valid until expiry even after another session performs logout unless an Auth-server check is made; do not claim instant global revocation from `getClaims()`;
- distinguish expected unauthenticated state from infrastructure failure without leaking token details;
- re-check current identity for every private read/write/delete request;
- no private response is statically cached or ISR-cached, and no Supabase client holding user state is shared at module scope across Vercel Fluid Compute requests.

### 4.4 Persistence model

Use one narrow application-owned table, planned name `saved_artifacts`, for immutable explicit snapshots. This avoids a premature relational rewrite of the already-validated browser contracts while still giving one auditable ownership/RLS boundary.

Planned columns:

- `id uuid primary key default gen_random_uuid()`;
- `owner_id uuid not null references auth.users(id) on delete cascade`;
- `kind text not null check (kind in ('profile','research','comparison','guide'))`;
- `schema_version smallint not null` initially `1`;
- `title text not null` with a small bounded length;
- `payload jsonb not null`;
- `created_at timestamptz not null default now()`.

Snapshots are immutable after insert. Phase 6A does not add an update/rename path; a user saves a new snapshot or deletes an old one. The application derives the saved title from validated artifact kind/current catalog metadata instead of collecting a new arbitrary title field: profile -> `Applicant profile`; Research/Guide -> current catalog target label; Comparison -> bounded public target summary. Stored title is presentation metadata only and is never trusted for ownership, target identity, restore routing, or evidence semantics.

The payload is an application-owned versioned discriminated union validated on both write and read:

- `profile`: exact `GuideApplicantProfile` only;
- `research`: exact validated `ResearchDossier`;
- `comparison`: exact validated `ComparisonResult`, including the dossier outcomes required for evidence resolution;
- `guide`: exact validated `GuideResult`, including its dossier and immutable applicant submission.

Do not persist Phase 2 documents/candidates/provider attempts/raw warnings, provider credentials, transport internals, browser error state, abort controllers, React reducer state, test markers, or arbitrary user HTML.

### 4.5 Bounds and storage-abuse behavior

Every saved request must have an actual streamed body bound independent of `Content-Length`. The persistence contract must also bound derived title, total artifact count, and serialized payload size. The bound must sit below the real hosting envelope: current Vercel Functions documentation limits both request and response payloads to 4.5 MB, while UniProof's accepted public Research response can itself approach 4 MiB. Phase 6A therefore leaves explicit envelope headroom rather than choosing a limit equal to the platform ceiling.

Initial implementation limits to encode in one server-owned module and SQL where practical:

- derived title: 1–120 trimmed characters;
- save request body: maximum **4,300,000 actual UTF-8 bytes**;
- profile payload: maximum 32 KiB serialized JSON;
- research/comparison/guide snapshot payload: maximum **4 MiB (4,194,304 bytes)** serialized JSON each;
- maximum **20** saved artifacts per owner;
- saved-list response returns at most those 20 bounded metadata rows in stable descending `(created_at,id)` order. Because the account itself cannot own more than 20 rows, Phase 6A deliberately does **not** add cursor/offset pagination; pagination would add state/error surface without increasing capability.

A valid in-memory result that exceeds the save ceiling remains fully usable in the current session; only Save fails with a neutral bounded `snapshot-too-large` outcome. This is particularly important for a worst-case four-target Comparison, whose embedded validated dossiers can legitimately exceed the platform-safe save-request envelope even though each individual Research response was valid. Phase 6A must not truncate a dossier/result, split it into an unreviewed multi-request persistence protocol, bypass the same-origin server boundary, or add Blob/chunk storage merely to force every theoretical maximum-size result to be saveable. The hackathon persistence feature is optional; preserving provenance and predictable ownership is more important than saving pathological maximum-size composites. If real verified demo/user Comparison payloads commonly exceed this bound, stop and revise the persistence architecture explicitly rather than weakening the limit ad hoc.

The 20-row owner limit must be race-safe at the database boundary, not only a preflight client count. The implementation may use a small transaction-safe Postgres enforcement function/trigger with a per-owner transaction/advisory lock, provided it is locally pgTAP-tested, has a fixed `search_path`, does not use caller-provided ownership, and does not become a general-purpose privileged RPC. If an equally simple native database constraint becomes available during implementation, prefer it. Do not solve this with eventual client cleanup or silent deletion of older user data.

### 4.6 RLS and privileges

RLS is enabled before any private table is considered usable.

Required policies/privileges:

- explicitly revoke private-table CRUD from `anon`/`PUBLIC` as appropriate to the generated Supabase privilege baseline; do not assume absence of an RLS policy is the only protection;
- explicitly grant `authenticated` only the table privileges the Data API/server user-scoped client needs in Phase 6A: `SELECT`, `INSERT`, and `DELETE`; revoke/no-grant ordinary `UPDATE`;
- `authenticated SELECT` RLS: only rows where `(select auth.uid()) = owner_id`;
- `authenticated INSERT` RLS: `WITH CHECK ((select auth.uid()) = owner_id)` and immutable validated columns;
- `authenticated DELETE` RLS: only rows where `(select auth.uid()) = owner_id`;
- no ordinary UPDATE policy in Phase 6A;
- no public policy, wildcard ownership, email/user-metadata-based ownership, or service-role-backed ordinary API path.

Database tests must prove both privilege and row-policy layers: User A can perform only the intended own-row operations; User A cannot update; User A cannot select, insert for, delete, or infer User B's rows; signed-out/`anon` requests have no private table CRUD; forged `owner_id` fails; cross-account stale UI cannot continue private operations after account change.

Because the browser necessarily holds a short-lived access JWT in the selected rich-client Auth model, an authenticated user could call the Supabase Data API directly with that token and the publishable key; this is expected and RLS must therefore be sufficient even when the same-origin application API is bypassed. Treat every row read back from the database as **untrusted user-controlled persisted input**, even though ownership is correct: the owner can potentially write its own schema-shaped JSON outside the UniProof UI. On restore, UniProof must re-run strict runtime parsing and every application-owned binding/invariant check before display. This is not a cross-user integrity boundary and Phase 6A does not add HMAC/signature infrastructure merely to stop an owner from editing their own private snapshot; the application instead refuses malformed/inconsistent snapshots and never elevates saved data into current evidence without an explicit new run.

A token already issued before sign-out can remain cryptographically valid until its `exp`, so the plan does not claim instantaneous revocation at the database JWT layer. The application-owned private APIs perform the stronger current Auth-server check before exposing/mutating saved data, production keeps a reasonable Supabase JWT lifetime rather than lengthening it, and any future requirement for immediate post-logout revocation at the direct Data API boundary would require an explicit `session_id`/`auth.sessions` enforcement design and fresh security review rather than an ad-hoc privileged function.

### 4.7 Private API boundary

Use a same-origin server-owned API surface rather than direct browser CRUD against Supabase. Planned routes:

- `GET /api/saved-artifacts` — all owned metadata rows (maximum 20), stable descending `(created_at,id)` order, authenticated only;
- `POST /api/saved-artifacts` — strict body, verified identity, artifact schema parse, server-derived title, save snapshot;
- `GET /api/saved-artifacts/[id]` — one complete revalidated owned snapshot;
- `DELETE /api/saved-artifacts/[id]` — exact owned UUID only.

Every private response is `Cache-Control: private, no-store`. Mutations apply the same same-origin/fetch-site posture as other state-changing endpoints. JSON and UTF-8 parsing are strict; errors are bounded and sanitized. A missing record and another user's record should be observationally equivalent (normally 404) to prevent object-existence disclosure.

Use one exact public error vocabulary so every caller and test maps the same cases: `unauthenticated`, `forbidden-origin`, `invalid-content-type`, `invalid-json`, `invalid-request`, `request-too-large`, `snapshot-too-large`, `snapshot-capacity-reached`, `snapshot-not-found`, `snapshot-invalid`, `snapshot-unsupported-version`, `snapshot-target-unavailable`, and `persistence-unavailable`. Do not expose SQLSTATE/PostgREST/Auth internals. A network disconnect after a non-idempotent Save/Delete can make completion ambiguous; Phase 6A does not add a generic automatic mutation retry. The client keeps one logical mutation single-flight, reports a neutral outcome-unknown state when transport completion is ambiguous, and refreshes the bounded Saved list before the user retries so duplicate saves or misleading delete-success claims are not manufactured.

The browser never sends `owner_id` or a free-form saved title as an authorization/persistence input. If owner metadata appears in a database row, omit it from the public private-artifact DTO. Stored title is never authoritative; target/program identity is re-derived from the parsed payload and current catalog where applicable.

### 4.8 Save/load semantics by mode

Restore must not introduce a second persistence channel. Use one **memory-only cross-route restore handoff** owned by the root application layout: the Saved workspace fetches and revalidates one artifact, publishes `{accountId, artifact}` into a small client context, then navigates to the owning mode; the destination consumes-and-clears it exactly once. Do not put artifact payloads, applicant data, or restore IDs into query/hash state, Web Storage, IndexedDB, Cache Storage, service workers, or cookies. Reloading during the handoff may lose the restore intent; the user can return to Saved and retry. Account change/sign-out clears the handoff before another user can consume it.

Every async restore/save/delete action needs explicit operation ownership. A response from an older Saved fetch/mutation must not replace a newer Research/Compare/Guide run, a newly loaded artifact, or another account's state. Before replacing a visible result, close any evidence sheet/dialog, await the existing presentation handoff where needed, then re-check mounted state, account identity, operation sequence, and active run ownership—preserving the Phase 5 cancellation-after-await fix rather than regressing it.

Current post-audit invariants are persistence requirements, not incidental UI details:

- application-owned university/program navigation is rebound from the **current catalog** on every restored dossier/result; source/evidence URLs remain dossier/source-owned;
- a target that no longer resolves in the catalog fails restore with `snapshot-target-unavailable`; never fall back to stored official target URLs;
- target-scoped evidence refs remain `{targetKey, claimId}` and all refs are preserved, including multiple competing refs and refs to context-rejected evidence retained for manual/fail-closed outcomes;
- unsupported-target correction state cannot be bypassed by restoring or re-running a saved target;
- saved Guide intake/year remains bound to its immutable public context, and explicit reassessment re-enters the existing finalizer so intake/year/category/target checks still apply;
- the closed Guide semantic alias registry, same-scale GPA rules, exact currency/period rules, context-rejected evidence handling, and all six assessment states are not widened by serialization/deserialization;
- previous current results remain visible through a failed/aborted refresh exactly as Phase 3–5 currently require.

**Profile**
- Saving is explicit opt-in from Guide/account UI.
- Explain that academic/financial profile data will be stored privately in the user's account when Save is used.
- Anonymous Guide remains ephemeral exactly as Phase 5.
- Loading a profile repopulates only validated Guide profile fields; it does not select a target, trigger Research, or auto-submit.

**Research**
- Save only a successfully client-validated dossier already accepted by Research UI.
- Loading renders it as a **saved snapshot** with original evidence timestamps/statuses and a visible Refresh action.
- Never silently promote a loaded saved dossier into current Research cache/reuse logic.

**Comparison**
- Save only a finalized validated `ComparisonResult`; partial results may be saved if the contract marks them partial.
- Preserve immutable target order, weights, dossiers/outcomes, target-scoped evidence refs, score suppression/coverage, and trade-offs.
- Loading does not re-score against newer catalog/evidence unless the user explicitly refreshes/re-runs.

**Guide**
- Save only a finalized `GuideResult`; this is explicit consent to persist the contained applicant profile snapshot.
- Loading preserves its original `assessmentDate`, public request context, dossier, six-state assessments, risks/checklist/timeline, unrecognized/manual evidence, and the complete evidence-ref arrays attached to every requirement/risk/checklist/timeline/budget item.
- Do not silently recalculate the saved result using today's date or new registry logic. Provide an explicit reassess/refresh path that starts from validated loaded inputs and creates a new result.

### 4.9 Schema evolution

Every artifact carries `schema_version`. On read:

- parse the database row first;
- dispatch by `kind + schema_version`;
- reject unknown future/obsolete versions as an unsupported saved snapshot, not as partially trusted data;
- never `as`-cast old JSON into a current contract;
- any future migration of payload semantics must be an explicit migration/version adapter with tests.

Phase 6A does not need a generic migration framework beyond version `1` and the fail-closed unknown-version behavior.

### 4.10 Local Supabase workflow

The installed Windows Supabase CLI is the implementation tool. Use migration files as source of truth.

Local-only implementation/test path:

1. initialize `supabase/` only if absent;
2. discover installed CLI syntax with `supabase --help` and relevant subcommand `--help`; create the imperative migration with `supabase migration new phase6_saved_artifacts` rather than inventing a timestamp filename by hand;
3. start the local stack through the Windows CLI;
4. `supabase db reset` against local only;
5. `supabase db lint`;
6. run the installed CLI's database advisor command if available and fix relevant security/performance findings rather than ignoring them;
7. `supabase test db` with pgTAP ownership/RLS/constraint tests;
8. use local Auth/Mailpit and invented users/data for browser integration tests;
9. stop/remove only disposable local test state when appropriate.

Never use `--linked`, a remote connection string, `migration repair`, or remote reset during Phase 6A local implementation unless a separately authorized external step explicitly requires it.

## 5. Phase 6B architecture — production hardening

### 5.1 Whole-run time budget

The current provider stages are individually bounded but the whole Research pipeline must finish before the hosting platform terminates the route. Current Vercel Fluid Compute documentation (revalidated 2026-08-19) gives Node functions a 300-second default/max on Hobby and a 300-second default with a larger ordinary maximum on Pro/Enterprise; Phase 6B deliberately targets the common 300-second baseline rather than a plan-specific larger limit or the optional 30-minute beta.

Server-owned limits:

- application whole-run deadline: **240 seconds** from accepted Research dispatch to finalization;
- Vercel `app/api/research/route.ts`: `export const maxDuration = 300` seconds;
- retain all existing smaller discovery/provider/stage deadlines and attempt ceilings.

The 60-second difference is finalization/serialization/cancellation/platform headroom. When the 240-second application deadline expires, stop new discovery/provider retries/fallback dispatch, abort in-flight work where supported, preserve already validated evidence, and return the truthful partial/failed lifecycle through existing contracts with unfinished work classified as operational `timeout`. A real caller abort remains `cancelled`. Never wait for Vercel's hard timeout as normal control flow and never start the 240-second expensive-run timer for requests rejected before accepted Research dispatch.

Phase 6B also opts only the Research function into Vercel Node request cancellation through repository configuration (`supportsCancellation: true`) so the existing `Request.signal` path can receive client disconnects where the deployed platform supports it. Local tests prove signal propagation and post-abort ownership; actual Vercel cancellation delivery remains Phase 6C live evidence. If the selected Vercel project has Fluid Compute disabled or rejects `maxDuration=300`, deployment remains blocked until the values are revised and the complete deadline/partial-result matrix is rerun; do not silently rely on a different account default.

### 5.2 Durable public abuse control

The current in-process/single-flight/provider budgets are not distributed request abuse protection.

Preferred deployment control: **Vercel WAF fixed-window rate limiting for exactly `POST /api/research` by source IP**, because it executes before the expensive function/provider path and is shared across function instances. Current Vercel documentation (revalidated 2026-08-19) exposes fixed-window rate limiting on all plans, with IP as an included counting key and Log as a non-blocking action. The provider default is 100 requests/60 seconds; UniProof's proposed **20 requests/60 seconds** is a deliberately stricter provisional product policy, not a Vercel default.

Initial operational plan:

1. verify the selected Vercel account/project and current WAF pricing before enabling it;
2. target path exactly `/api/research` and method exactly `POST`; do not rate-limit static assets, Auth callbacks, Saved APIs, or the whole site;
3. create/publish the rule initially in **Log** mode and exercise the complete judge flow;
4. use a fixed 60-second window and initial **20 requests/source-IP** threshold;
5. verify one Research + four-target Compare + Guide + intentional refresh/retry sequence stays below the threshold from one browser and document shared-NAT/university-Wi-Fi false-positive risk;
6. verify over-threshold traffic is observable at the WAF boundary without deliberately exhausting providers or creating abusive load;
7. after normal-flow observation and explicit authorization/pricing review, switch to Rate Limit with Vercel's default 429 response only if the threshold is still appropriate;
8. rerun normal and over-limit acceptance.

Phase 6B documents/tests this contract only; WAF publication/enforcement remains a Phase 6C external mutation. If pricing/account constraints make Vercel WAF unacceptable, public deployment remains blocked until another truly durable distributed control is designed and reviewed. Do **not** fall back to an in-memory token bucket/instance map/hidden test mode and call it distributed rate limiting.

Application UI/client transport must recognize a raw deployment-generated HTTP 429 **before** requiring application JSON/content type, discard/cancel its body without reflecting WAF internals, preserve prior Research/Compare/Guide state, and never auto-retry. Local tests fabricate/intercept the platform response; they do not claim the WAF is active.

### 5.3 Host cancellation verification

Vercel Node request cancellation is opt-in, not automatic. Phase 6B must add repository configuration with `supportsCancellation: true` scoped only to the Research function so the existing web-standard `Request.signal` path can receive disconnects when deployed. Local unit/browser tests then prove that an aborted request signal stops new retries/fallbacks/stages and preserves lifecycle ownership; they do **not** prove Vercel delivered the signal.

Phase 6C deploy-time testing must determine the actual Vercel Node runtime behavior and verify that:

- client navigation/abort/disconnect reaches the Research route after the configured cancellation opt-in;
- caller abort remains distinguishable from the independent 240-second application deadline;
- the route stops new fallback/retry work after cancellation/deadline;
- no later provider call starts after terminal ownership;
- a platform hard timeout (normally HTTP 504) is treated client-side as a sanitized deployment-timeout outcome even if its body is HTML/plain/empty rather than application JSON;
- sanitized logs do not contain prompts/source bodies/profile data/secrets.

If platform cancellation is not delivered reliably, the 240-second application-owned deadline remains mandatory and the residual risk is documented rather than hidden. Do not add background/waitUntil work for provider calls merely to survive a cancelled user request.

### 5.4 Production secrets and environment separation

Environment names must be explicit for Development/Preview/Production. Do not copy secrets into docs, screenshots, CLI output, Actions logs, or client bundles.

Production configuration distinguishes **valid shape** from **release readiness**. `NEXT_PUBLIC_APP_URL` must be an exact non-local HTTPS origin and live Research must be deliberate. Optional Supabase Auth/save is either fully configured with a valid exact HTTPS Supabase origin plus publishable key or fully absent/disabled; ordinary runtime does not require the service-role key. Provider fallbacks remain individually optional, but a release-ready live Research profile requires at least one configured general-web discovery provider (`TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY`) and at least one configured structured AI provider (`GEMINI_API_KEY`, `GROQ_API_KEY`, or `OPENROUTER_API_KEY`). Missing secondary providers lower resilience rather than invalidating configuration. The checked-in direct official-URL discovery path remains a truthful degraded fallback, not justification for calling a zero-search-key production profile release-ready; a zero-AI-key profile similarly degrades but cannot complete extraction/reconciliation. All provider keys remain server-only.

Phase 6B adds a non-network release-configuration verifier that reports variable names/readiness reasons only, never values, lengths, prefixes, hashes, project refs, or credential fingerprints. Development/CI profiles remain usable without production secrets. Vercel CLI may list variable names/scopes for verification; do not use `vercel env pull` or equivalent secret export merely to inspect values. When values must be configured in Phase 6C, use a separately authorized secret-entry path that does not echo them.

### 5.5 Domain, TLS, HSTS, CSP, headers

Production acceptance must verify:

- canonical deployed origin and redirect behavior;
- HTTPS only for the canonical public origin;
- valid TLS certificate/host identity;
- existing nonce CSP on actual HTML;
- no development `unsafe-eval`/script exception in production;
- nonce survives auth-session Proxy composition;
- no third-party runtime script/analytics unless separately reviewed;
- expected referrer/frame/content-type/permissions headers;
- framework disclosure remains removed.

Current Vercel documentation states that deployment responses automatically include `Strict-Transport-Security: max-age=63072000`. Phase 6B therefore **does not add an application-owned duplicate HSTS header** merely for production hardening and does not add `includeSubDomains` or `preload`. Phase 6C must verify the actual deployed canonical HTTPS response and record the observed platform header. If hosting changes away from Vercel or the platform no longer supplies HSTS, that is a fresh deployment/security decision rather than a reason to guess locally. Do not attempt to control the parent `vercel.app` domain.

### 5.6 Current provider/privacy/terms check

Phase 6B must freeze the current provider assumptions in tests/docs **without making live calls**, and Phase 6C must re-open the primary documentation again immediately before the one bounded live smoke.

Current 2026-08-19 release assumptions:

- **Gemini:** migrate the existing Interactions adapter from `/v1beta/interactions` to the stable `/v1/interactions` surface while preserving the already-updated `steps`/`response_format` schema, `store:false`, no tools, `gemini-3.5-flash-lite` normal path, and `gemini-3.5-flash` quality escalation. Both models are currently stable and free-tier-capable. Google's unpaid Gemini terms state submitted content/responses may be used to improve products and may receive human review, so **only public university/source material may reach Gemini**; applicant/account/private saved data remains mechanically excluded. Do not claim free Gemini is ZDR.
- **Groq:** retain `openai/gpt-oss-120b` strict structured output. Groq currently does not retain ordinary inference customer data by default, but may temporarily retain inputs/outputs for reliability/abuse investigation for up to 30 days unless account data controls/ZDR are enabled. Phase 6B does not mutate those account settings.
- **OpenRouter:** retain `require_parameters:true`, `data_collection:"deny"`, and conditional request-level `zdr:true` when `UNIPROOF_OPENROUTER_REQUIRE_ZDR` is enabled. Require the concrete routed model ID rather than treating `openrouter/free` as a concrete model. Do not widen routing to data-collecting providers.
- **Tavily:** retain public-query Search only, `search_depth:"basic"`, `include_answer:false`, `include_raw_content:false`, and `auto_parameters:false`; do not make unsupported blanket ZDR claims. Retrieved source evidence still comes through UniProof's own bounded retrieval/evidence path rather than trusting provider snippets as final evidence.
- **Brave:** retain public-query discovery and application use of URL/title/rank only. Brave's standard Search API privacy notice currently retains query records for up to 90 days for billing/troubleshooting and Enterprise offers ZDR; general API data storage is restricted unless the subscribed plan grants storage rights. Therefore UniProof must not persist raw Brave responses/snippets and must not claim the standard/free-credit route is ZDR.

For every provider, verify before release that endpoint/model still exists, the intended account/free-route configuration remains usable, privacy/data controls still mean what tests/docs assume, provider keys remain server-only, and no paid escalation was introduced. A provider-policy change that invalidates the public-only/privacy/cost invariant is a release blocker or explicit architecture change; never silently relax the invariant.

### 5.7 CI / GitHub Actions

Add a least-privilege CI workflow only; do not add automatic production deployment.

Required CI properties:

- trigger on `pull_request` and normal `push`; never use `pull_request_target` for untrusted contribution code;
- top-level `permissions: contents: read` and no write/deploy token permissions;
- no provider/Vercel/hosted-Supabase production secrets on CI jobs;
- pin the Node 22 line to the exact project baseline verified during implementation and use lockfile-driven `npm ci`;
- pin third-party Actions such as checkout/setup-node/Supabase setup by their **full 40-character commit SHA**, resolving that SHA from the official action repository at implementation time and keeping the human-readable release tag only as a YAML comment; never invent a SHA or leave floating `@main`/major tags;
- deterministic Vitest, TypeScript, ESLint, production build, production dependency audit/workspace/release-configuration checks;
- Playwright browser acceptance in fixture/intercepted mode with retries zero;
- local Supabase reset/db lint/advisors/pgTAP/Auth-Saved tests using the fixed locally verified Supabase CLI 2.114.0 and local containers only; never `--linked` or a remote DB;
- bounded `timeout-minutes` and concurrency cancellation for superseded branch/PR runs;
- do not upload traces/screenshots by default; if a failure artifact is indispensable, upload only a deliberately sanitized bounded path and prove it cannot contain `.env*`, auth cookies, Mailpit magic links/message bodies, provider responses, private profiles, Supabase `.temp`, or `ui-flow-screenshots/`.

CI must not call live AI/search providers, mutate hosted Supabase, call Vercel deployment/config APIs, publish releases, or submit Devpost. Local workflow/config validation is not a green GitHub CI run; Phase 6C/publication evidence must record an actual Actions run on the exact pushed commit.

### 5.8 Requirements traceability and final local audit

Before Phase 6C:

- map every MVP requirement to implementation and test evidence;
- repeat full Phase 0–6 browser acceptance in development and built mode;
- repeat high-risk auth/session/account-switch/RLS/cancel/rate-limit lifecycle suites at least five times with configured retries zero;
- run security/privacy/secret/client-boundary/UTF-8 scans;
- inspect dependencies and production audit;
- inspect protected screenshot manifest;
- run a separate defect-first final review under the current `AGENTS.md` model policy;
- synchronize docs only from observed behavior.

## 6. Phase 6C architecture — deployment and submission

Phase 6C contains external side effects and therefore executes only with explicit user authorization for the relevant targets.

### 6.1 Hosted Supabase release

Before any remote migration:

1. identify the exact Supabase account/project/ref and environment;
2. confirm it is the intended UniProof target and not another project;
3. inspect local migration order and local green db reset/tests;
4. link only after authorization;
5. run `supabase db push --dry-run` and inspect the exact pending migration list;
6. do not use remote reset or migration-history repair;
7. apply `supabase db push` only after the dry run matches the intended set;
8. verify RLS/policies/privileges and cross-user isolation using invented test accounts;
9. remove exact test-only records/accounts when authorized and preserve no private test residue.

Auth Site URL/redirect allowlist/email delivery are external configuration and must be verified against the final Vercel origin. If production passwordless delivery is not trustworthy, disable/hide account save features rather than blocking anonymous judges or pretending auth works.

### 6.2 Vercel release

Before creating/linking/deploying:

1. use read-only CLI inspection to identify account/team/project state;
2. verify whether Git integration would make a later push auto-deploy and account for that side effect before Git publication;
3. confirm the intended project name, production branch, runtime, Fluid Compute/duration support, and region;
4. configure only the necessary environment names/values through an authorized secret-safe path;
5. configure/observe the WAF rate-limit rule as specified in Phase 6B;
6. deploy a preview first;
7. run preview smoke/security/browser checks;
8. promote/deploy production only after preview acceptance;
9. verify the final canonical URL, headers, TLS, CSP, function behavior, logs, and rollback target.

Never delete an existing project/deployment/domain to resolve a naming/configuration issue without explicit exact-target authorization.

### 6.3 Bounded live smoke budget

Live smoke must be deliberately small and recorded without secret/raw-payload retention.

Minimum production smoke after explicit authorization:

- anonymous Home/Research/Compare/Guide route health;
- exactly one representative end-to-end live Research run on a supported program using the normal primary path;
- evidence/source-link integrity from that result;
- one 3-target Compare using validated Research responses, with no forced provider fallback;
- one Guide assessment using invented applicant data, proving the private marker never appears in provider-bound requests/logs;
- auth/save/load/delete with invented account/profile data if auth is enabled in production;
- one client cancellation test that does not intentionally force excess provider calls;
- one rate-limit over-threshold test only if it can be performed without abusive traffic or meaningful provider spend; prefer a WAF-level test that blocks before the function.

Do not deliberately exhaust provider quotas, fan out providers, scrape broadly, or create load merely to demonstrate resilience. Provider fallback correctness remains primarily deterministic fixture/test evidence.

### 6.4 Release assets

Generate release screenshots only after the deployed behavior is verified. Store new release assets in a dedicated documented path such as `docs/assets/screenshots/phase-6/`; never overwrite `ui-flow-screenshots/`.

Required screenshot set should show, at minimum:

- Research result with evidence sheet/source;
- Compare with weights, coverage/score and evidence/trade-off;
- Guide with a mixed requirement state and evidence-linked checklist/timeline;
- responsive/mobile product view.

Use invented applicant data. Inspect screenshots for emails, tokens, project IDs that should not be public, browser developer tools, unrelated tabs, notification content, or private account information before publication.

### 6.5 Demo

Prepare an approximately three-minute deterministic demo path:

1. problem: international applicants must reconcile fragmented, stale, conflicting university information;
2. Research: supported program -> live/validated evidence -> source inspection -> unknown/conflict/freshness behavior;
3. Compare: 3 options -> user priorities -> evidence coverage/fit is not ranking -> trade-off evidence;
4. Guide: invented applicant profile -> deterministic six-state assessment -> risks/checklist/timeline -> no admission probability;
5. architecture/AI: AI extracts/reconciles public evidence, deterministic gates own factual status and downstream scoring/assessment;
6. privacy/failure message: applicant data is not sent through the research AI/search provider path; provider failure degrades to partial/unknown rather than fabrication.

Do not rely on unpredictable live providers for the entire recorded demo. Use a verified deployment and a deterministic demo sequence/saved safe snapshot where needed, while truthfully explaining what is live versus previously verified.

### 6.6 GitHub and Devpost release

Before any authorized Git publication:

- verify exact repo/branch/remote/status/diff;
- secret scan the exact staged/publication set;
- preserve user-owned unrelated changes;
- verify public repository, LICENSE, README, architecture explanation, setup instructions, screenshots, and no secret/private artifacts;
- ensure CI is green on the exact commit.

Immediately before Devpost submission, re-check the live event page/rules/schedule and record the current submission requirements. The 2026-08-19 check found the live event branded `$13,000+ in Prizes`, with submissions ending 2026-08-22 at 21:30 IST = 16:00 UTC = 23:00 Bangkok time; this remains mutable and is not a substitute for the final re-check.

Devpost submission itself requires a final explicit authorization after the user has had an opportunity to review the exact project title/description/repository URL/hosted URL/demo URL and other submitted fields.

## 7. Failure and edge-case matrix

Phase 6 implementation must explicitly cover at least the following classes.

### Authentication/session

- blank/malformed/very long/Unicode email;
- repeated magic-link requests and upstream auth rate limiting;
- email enumeration resistance;
- malformed, expired, replayed, wrong-type, missing token hash;
- callback with untrusted `next`/redirect input;
- signed-out refresh;
- refresh failure; revoked session; expired session;
- sign out while Save/list/delete is in flight;
- account switch with stale private UI/result in memory;
- two tabs with different session timing;
- CSP Proxy + auth refresh cookie/header preservation;
- authenticated response cache isolation;
- Supabase outage/degraded auth without breaking anonymous modes.

### Persistence/RLS

- forged owner UUID;
- cross-user list/get/delete;
- UUID for another user's artifact returns non-disclosing not-found behavior;
- signed-out private endpoint access;
- malformed JSON/fatal UTF-8/dishonest or absent Content-Length/oversize stream;
- unknown keys/kinds/schema versions;
- payload valid structurally but inconsistent with Research/Compare/Guide invariants;
- request body exactly 4,300,000 bytes/one byte over and payload exactly 4 MiB/one byte over;
- 20-row owner cap and concurrent 21st saves;
- valid oversized Comparison/Guide snapshot remains usable in memory and fails Save neutrally without truncation/chunking;
- full 20-row list has stable descending `(created_at,id)` ordering, including identical timestamps, without pagination state;
- deleted account cascade;
- stale/hostile catalog URL in saved dossier rebound on presentation without rewriting evidence source URLs; removed/reassigned current catalog target fails restore;
- owner-authenticated direct Data API write produces malformed/internally inconsistent own JSON -> app GET/restore rejects it rather than treating RLS as content integrity;
- memory-only restore handoff is exact-account/exact-kind/single-consume, is cleared on signout/account change, and cannot overwrite a newer Research/Compare/Guide run after an await;
- Guide historical restored dossier never seeds current-session `reusableDossier`;
- Guide restored multiple/context-rejected evidence refs remain complete and preserve deterministic ineligibility/manual status;
- saved old evidence never silently treated current, rescored, reassessed, or provider-refreshed;
- delete twice/non-disclosing messaging and transport-ambiguous Save/Delete reconciliation without blind mutation retry;
- database/network/Auth-validation failure during save/read/delete leaves current in-memory product result intact and does not weaken identity checks;
- no partial/truncated row accepted.

### Research production

- whole-run deadline before host deadline;
- caller cancellation before/after awaited boundaries;
- cancellation during retrieval/model body reads;
- provider timeout/retry/fallback near total deadline;
- partial result preserved when deadline exhausts remaining work;
- platform-generated 429/504/non-JSON errors safely mapped;
- WAF normal-flow threshold versus burst threshold;
- shared/NAT source rate-limit usability risk documented/observed;
- no retry storm after 429;
- no provider call after terminal cancellation/deadline.

### Deployment/security

- Preview versus Production env separation;
- missing optional auth config does not break anonymous build;
- missing required live Research config produces bounded configuration/partial behavior;
- no secret in client/static/source maps/logs/screenshots/traces/Actions artifacts;
- HTTPS redirect/canonical host;
- CSP nonce and auth `Set-Cookie` coexist;
- production lacks dev CSP exceptions;
- HSTS only on intended production HTTPS response and no accidental preload/subdomain scope;
- external source links retain no-referrer behavior;
- no third-party scripts/analytics introduced by hosting/auth UI.

### Release/submission

- exact commit differs from tested deployment;
- Vercel Git integration causes unintended auto-deploy on push;
- stale README screenshot or dead hosted/source link;
- live provider quota exhausted during judging;
- auth email unavailable during judging while anonymous flow remains viable;
- demo exposes personal/secret data;
- Devpost rules/prize/deadline changed since prior snapshot;
- submission fields point at preview instead of production;
- final action occurs only after explicit authorization.

## 8. Verification hierarchy

Evidence must be labeled accurately:

1. static source/schema review;
2. local migration reset/db lint/pgTAP;
3. Vitest unit/integration;
4. TypeScript/ESLint/build/audit;
5. deterministic dev browser acceptance;
6. built-app browser acceptance;
7. local Supabase Auth/RLS browser integration;
8. CI on the exact commit;
9. authorized preview deployment verification;
10. authorized production/live-service verification;
11. authorized publication/submission verification.

A lower level must never be reported as a higher one.

## 9. Phase completion gates

### Phase 6A complete locally when

- optional auth works against local Supabase without weakening anonymous modes;
- one Proxy safely composes auth refresh and CSP;
- database migrations recreate from zero;
- db lint + pgTAP prove RLS/ownership/limits;
- private API derives identity server-side and is strict/no-store;
- save/load/delete and cross-device-equivalent local sessions work for all four artifact kinds;
- saved snapshot freshness semantics are explicit;
- Guide profile markers remain absent from Research/provider requests;
- account switch/signout/race suites pass;
- complete Phase 0–6A regression gates pass.

**Observed completion evidence (2026-08-19):** Phase 6A meets this local gate. Final Vitest passed **508/508**; TypeScript, ESLint, Next.js 16.3.1 production build, `npm audit --omit=dev` (0 vulnerabilities), `npm ci --dry-run --ignore-scripts`, workspace verification, and repository UTF-8/control scans passed. Local Supabase reset/lint/advisors passed and pgTAP passed **40/40**. Development Playwright passed Research **67/67**, Compare **55/55**, Guide **50/50**, and Auth/Saved **7/7**. Guide lifecycle repeated five times **55/55** with retries zero; the seven-case Auth/Saved lifecycle repeated five times **35/35** with retries zero. Built-production anonymous/core Playwright passed Research **67/67**, Compare **55/55**, and Guide **50/50**. Authenticated built-mode against local HTTP Supabase is intentionally not claimed because production CSP correctly requires an HTTPS Supabase origin. Hard-coded credential/client-boundary scans found no retained real credential values; the Supabase CLI's ignored `.temp` local runtime secrets remain outside Git.

Hosted Supabase mutation is **not** required to call the local implementation batch complete; it stays a Phase 6C external action.

### Phase 6B complete locally/configuration-ready when

- whole-run application deadline is proven below planned host duration;
- production abuse-control configuration is specified and can be applied without code ambiguity;
- 429/deadline/cancellation behavior is covered;
- production CSP/TLS/HSTS/env/provider checks are defined and locally testable portions pass;
- least-privilege CI is green using fixtures/local Supabase only;
- full requirements traceability has no unexplained MVP gap;
- complete local dev+built/security/privacy matrix and final review pass.

### Phase 6C complete when

- authorized remote Supabase migrations/RLS/Auth configuration are verified;
- authorized Vercel preview and production deployment are verified;
- durable rate limiting is actually active and observed;
- bounded live smoke passes;
- final production security/secret/privacy checks pass;
- release README/screenshots/demo are based on verified behavior;
- exact public repository/deployed commit are traceable;
- current Devpost requirements are rechecked;
- Devpost submission is completed only after explicit final authorization.

## 10. Explicit exclusions

Do not add during Phase 6 unless the user separately changes scope:

- global university coverage;
- document uploads or sensitive document storage;
- automatic application submission;
- admission-probability prediction;
- currency/GPA/test conversions;
- counselor collaboration/shared artifacts/public share links;
- complex roles/organizations/team workspaces;
- multilingual UI;
- background queues/workers simply to redesign the current bounded Research request;
- broad analytics/advertising/third-party runtime scripts;
- a generic admin dashboard;
- production multi-agent orchestration;
- automatic paid AI escalation.

Phase 6 is complete when the existing evidence-first MVP is privately safe where state is saved, operationally bounded in production, demonstrably deployable, and submission-ready—not when UniProof has acquired every possible SaaS feature.

## 11. Planning references verified on 2026-08-19

Re-check mutable sources during implementation/deployment. Current planning used:

- Supabase SSR/Auth: `https://supabase.com/docs/guides/auth/server-side`
- Supabase Next.js SSR client/claims guidance: `https://supabase.com/docs/guides/auth/server-side/creating-a-client`
- Supabase SSR session/cookie/revocation caveats: `https://supabase.com/docs/guides/auth/server-side/advanced-guide` and `https://supabase.com/docs/guides/auth/sessions`
- Supabase passwordless email: `https://supabase.com/docs/guides/auth/auth-email-passwordless`
- Supabase local development/testing: `https://supabase.com/docs/guides/local-development/cli-workflows` and `https://supabase.com/docs/guides/local-development/cli/testing-and-linting`
- Supabase migration CLI: `https://supabase.com/docs/reference/cli/v0/supabase-migration`
- Vercel function duration/payload limits: `https://vercel.com/docs/functions/configuring-functions/duration` and `https://vercel.com/docs/functions/limitations`
- Vercel Node request cancellation / function config: `https://vercel.com/docs/functions/functions-api-reference`
- Vercel automatic response headers/HSTS: `https://vercel.com/docs/headers/response-headers`
- Vercel WAF rate limiting/pricing: `https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting` and `https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing`
- Vercel CLI project/env inspection: `https://vercel.com/docs/cli/project` and `https://vercel.com/docs/cli/env`
- Gemini stable API versions / Interactions: `https://ai.google.dev/gemini-api/docs/api-versions` and `https://ai.google.dev/gemini-api/docs/interactions-overview`
- Gemini unpaid-service data terms: `https://ai.google.dev/gemini-api/terms`
- Groq model/data controls: `https://console.groq.com/docs/model/openai/gpt-oss-120b` and `https://console.groq.com/docs/your-data`
- OpenRouter provider privacy/capability routing: `https://openrouter.ai/docs/guides/routing/provider-selection` and `https://openrouter.ai/docs/guides/features/zdr`
- Tavily Search parameters/credits: `https://docs.tavily.com/documentation/api-reference/endpoint/search` and `https://docs.tavily.com/documentation/api-credits`
- Brave Search API privacy/storage: `https://api-dashboard.search.brave.com/documentation/resources/privacy-notice` and the current Brave Search API terms/documentation linked from `https://api-dashboard.search.brave.com/documentation`
- Pixel Forge Devpost overview/rules/schedule: `https://pixel-forge-ai-hackathon-08.devpost.com/`
