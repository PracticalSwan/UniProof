# Phase 6C Deployment and Hackathon Submission Implementation Plan

> **For agentic workers:** REQUIRED PROCEDURE: follow `AGENTS.md` model-specific execution/review rules. This plan contains external actions. Reaching a checkbox is not authorization to perform it; obtain/confirm the explicit user authorization required for the exact Supabase, Vercel, GitHub, provider-quota, publication, or Devpost action before invoking it.

**Goal:** Safely release the already locally verified Phase 0–6B application to the intended Supabase/Vercel targets, verify production security and bounded live behavior, prepare truthful release assets, and submit the exact verified project to Devpost only after final user authorization.

**Architecture:** Apply migrations/configuration only after dry-run/target confirmation, deploy Preview before Production, activate durable rate limiting after observation, execute a deliberately bounded live smoke, bind all release claims/assets to observed production behavior and the exact Git commit, then perform GitHub/Devpost publication as separate final gates.

**Tech Stack:** Supabase CLI 2.114.0, Vercel CLI 59.1.4, GitHub CLI 2.97.0, Vercel/Supabase dashboards/APIs only where the installed CLI does not expose a safe required operation, Next.js production deployment, Playwright/browser verification.

**Spec:** `docs/planning/phase-6-hardening-submission-readiness.md`, especially Section 6 and the Phase 6C completion gate.

## Global constraints

- Phase 6A and 6B local gates must be green first.
- Before every external mutation, state/verify exact target, intended action, risk, and rollback/reversible alternative.
- Use read-only CLI discovery first; never infer account/project identity from a folder name.
- In CodexPro WSL, use `/mnt/c/Windows/System32/cmd.exe /d /s /c "<cli command>"` for the installed Windows CLIs when direct invocation fails.
- Never print/export secrets, tokens, DB passwords, connection strings, auth cookies, or provider keys into chat/logs/docs.
- Never run remote `supabase db reset`, migration-history repair, broad SQL cleanup, Vercel project removal, GitHub visibility changes, forced Git history changes, or other destructive work as routine release steps.
- Use invented test accounts/profile data in production smoke; no real applicant private data.
- No deliberate quota exhaustion, abusive load, provider fan-out, or malicious/security-bypass activity.
- Preserve `ui-flow-screenshots/`; release screenshots go elsewhere.
- If a critical security/privacy/RLS/rate-limit/deployment gate fails, stop release progression, fix locally, reverify, and redeploy a new candidate. Do not rationalize a failed gate because the deadline is close.

---

## Task 1 — Re-read current release state and re-verify mutable external facts

Before any external command:

- [ ] Read canonical governance, Phase 6 spec, 6A/6B completion evidence, requirements traceability, operations docs, security docs, README/license.
- [ ] Inspect Git root/branch/status/remotes/diff and identify the exact candidate source revision. If changes are uncommitted, do not invent a deploy/repository traceability claim.
- [ ] Re-check current Pixel Forge Devpost overview, rules, schedule, required fields/assets, eligibility, and any sponsor/API requirements.
- [ ] Re-check current Supabase SSR/Auth/SMTP/CLI guidance.
- [ ] Re-check current Vercel plan function-duration, firewall/rate-limit pricing and available configuration methods.
- [ ] Re-check current provider endpoint/model/privacy/free-tier assumptions.
- [ ] Update release docs if any mutable fact changed.

**Release blocker:** any current rule/platform/provider change that invalidates a documented invariant must be resolved before external mutation.

---

## Task 2 — Read-only account/project discovery with installed CLIs

### Supabase read-only discovery

After confirming the CLI is authenticated, use only safe list/inspect commands first:

- [ ] identify the intended account/organization and candidate UniProof project;
- [ ] record project name/ref/region in private execution notes without secret values;
- [ ] if no project exists, stop and obtain explicit authorization to create one, including region/plan/cost implications;
- [ ] if multiple similarly named projects exist, do not guess.

### Vercel read-only discovery

- [ ] `vercel whoami`/equivalent account identity;
- [ ] `vercel project ls --json` or equivalent read-only list;
- [ ] inspect intended existing project if present;
- [ ] identify team/scope, production branch, current Git integration, framework/runtime settings, and whether a push would auto-deploy;
- [ ] if no intended project exists, stop before project creation until explicitly authorized.

### GitHub read-only discovery

- [ ] `gh repo view` the exact `PracticalSwan/UniProof` destination or current configured remote;
- [ ] verify repository visibility/license/default branch and Actions state without changing them;
- [ ] inspect whether branch protection/required checks affect the planned publication flow;
- [ ] never retrieve Actions secrets.

Document only non-secret target identifiers needed to prevent wrong-project release.

---

## Task 3 — Hosted Supabase target authorization and migration dry run

**External mutation gate:** linking the local repo to a hosted Supabase project changes local persistent project linkage and establishes a remote target. Confirm explicit authorization for the exact project ref before `supabase link`.

After authorization:

- [ ] link only the intended UniProof hosted project;
- [ ] inspect local migration list/order and hosted migration history read-only;
- [ ] run `supabase db push --dry-run`;
- [ ] capture only migration filenames/status, never DB passwords/URLs;
- [ ] prove the dry run contains exactly the expected Phase 6 migrations and no unexpected historical repair/reset/destructive statement;
- [ ] review SQL again for `DROP`, broad `DELETE`, privilege escalation, unsafe SECURITY DEFINER/search-path, accidental anon grants, disabled RLS, or unrelated schema changes;
- [ ] if hosted schema/history diverges, stop. Do not use `migration repair`, direct dashboard edits, or `--include-all` as a shortcut until the discrepancy is understood and separately planned.

**No migration is applied in this task.**

---

## Task 4 — Apply hosted Supabase migrations with exact rollback awareness

**External database mutation gate:** confirm explicit authorization for `supabase db push` to the exact project after the dry-run result is shown/reviewed.

- [ ] identify whether the target contains any user data. For a new hackathon project, prove it is empty/new rather than assuming.
- [ ] record a rollback strategy before push. Prefer forward corrective migrations; do not plan remote reset.
- [ ] run exactly one coordinated `supabase db push` from the approved migration set;
- [ ] observe successful migration history; no concurrent second pusher;
- [ ] run safe read-only schema/policy verification after push;
- [ ] do not inject seed/demo users into production through migration.

If push partially fails:

- [ ] stop further release work;
- [ ] inspect exact migration state/history;
- [ ] do not retry blindly;
- [ ] write a corrective local migration or targeted recovery plan based on observed state;
- [ ] obtain fresh authorization if recovery changes remote state beyond the original approved push.

---

## Task 5 — Configure and verify production Supabase Auth safely

**External configuration gate:** changing Auth URLs/email/SMTP/provider settings requires authorization.

- [ ] configure Site URL to the final intended canonical Vercel production origin only after that origin is known, or use a temporary exact Preview allowlist during preview testing;
- [ ] add only exact required redirect URLs; no wildcard domains if avoidable;
- [ ] verify Magic Link/PKCE template matches the implemented `/auth/confirm` token-hash flow;
- [ ] configure/verify production-capable email delivery before calling auth production-ready. Current Supabase default development mail service must not be represented as a robust production mail path;
- [ ] confirm email sender/domain configuration does not expose unrelated private account data;
- [ ] verify auth rate limits/current settings are appropriate; do not weaken anti-abuse controls merely for demo convenience;
- [ ] inspect the production access-token/JWT lifetime and keep it at a reasonable current Supabase-supported value; do not lengthen it for convenience. Record that sign-out removes sessions/refresh capability but an already issued access JWT can remain valid until `exp`, with owner-scoped RLS limiting that residual. If the product later requires immediate direct-Data-API revocation, design/test explicit `session_id` enforcement rather than claiming the standard JWT flow already provides it;
- [ ] do not enable social/phone providers that are not implemented/tested.

If robust email delivery cannot be configured by release time:

- [ ] keep anonymous Research/Compare/Guide fully enabled;
- [ ] disable or clearly mark account/save feature unavailable in production rather than presenting broken auth;
- [ ] do not remove the locally verified persistence code merely to hide the configuration gap.

---

## Task 6 — Verify hosted RLS/ownership with invented users before app deployment

Use two invented production test accounts only if production Auth is enabled and explicit test-account creation is authorized.

- [ ] create User A and User B through normal Auth flow, not direct privileged insertion if avoidable;
- [ ] A inserts/reads/deletes own artifact through the intended application/user-scoped interface;
- [ ] B cannot select A row;
- [ ] B cannot delete A row;
- [ ] A cannot forge B ownership;
- [ ] anon cannot access saved rows;
- [ ] 20-row cap behavior can be tested with a smaller controlled SQL/test mechanism only if it does not create unreasonable production residue; the full concurrency/cap proof remains local pgTAP evidence;
- [ ] delete exact production smoke artifacts/accounts after their purpose when authorized and verify deletion; never broad-clean the table.

Do not use the service-role key to make the RLS test pass.

---

## Task 7 — Vercel project target/configuration authorization

**External mutation gate:** link/create/configure the exact Vercel project only after explicit authorization.

Before mutation:

- [ ] show/record intended Vercel account/team, project name, Git repo (if any), production branch, framework preset, region, Fluid Compute/function duration capability, and canonical domain strategy;
- [ ] identify whether linking writes `.vercel/` local metadata and ensure it remains ignored/unpublished as appropriate;
- [ ] inspect whether existing project has data/domains/settings that could be overwritten.

After authorization:

- [ ] link existing intended project or create exactly one new UniProof project;
- [ ] do not delete/recreate an existing project to solve configuration issues;
- [ ] verify the selected project has Fluid Compute/function behavior compatible with the Phase 6B contract: Research route `maxDuration=300`, repository `supportsCancellation:true` for Research, and 240-second application-owned deadline; if the project rejects or overrides those values, stop and revise/retest 6B rather than deploying with an assumed limit;
- [ ] verify Node runtime/region settings are compatible with outbound retrieval and Supabase latency;
- [ ] verify actual request-cancellation delivery in Preview with a bounded client abort test; local signal tests alone were not deployment evidence;
- [ ] do not enable unreviewed analytics/third-party scripts.

---

## Task 8 — Configure Vercel environment variables without secret exposure

**External secret mutation gate:** exact variable names/scopes must be reviewed; actual values are entered through a secret-safe authorized path.

Required process:

- [ ] list existing variable **names/scopes only**;
- [ ] reconcile against the Phase 6 environment contract;
- [ ] remove/replace stale variables only with authorization and only after proving they are UniProof-specific;
- [ ] set `NEXT_PUBLIC_APP_URL` to the canonical Production URL at the correct stage;
- [ ] set Supabase public URL/publishable key only where auth/save is enabled;
- [ ] set provider keys server-only for Production; set Preview only if preview live-provider smoke is explicitly desired;
- [ ] satisfy the Phase 6B release-readiness matrix without making every fallback mandatory: at least one general-web discovery key (Tavily or Brave) and at least one structured AI key (Gemini, Groq, or OpenRouter); missing secondary fallbacks are a resilience note, while zero providers in either required class block a live-production readiness claim;
- [ ] set live Research mode deliberately; no implicit provider activation;
- [ ] run the Phase 6B non-secret release-config verifier against **presence/scopes only** after configuration; never use it to print or fingerprint values;
- [ ] keep `SUPABASE_SERVICE_ROLE_KEY` unset if the runtime does not require it;
- [ ] verify no server secret has `NEXT_PUBLIC_` prefix;
- [ ] never use `vercel env pull`/export merely to inspect values;
- [ ] never paste secret values into docs/chat/test logs.

After configuration, verify presence by names/scopes and application behavior, not by echoing values.

---

## Task 9 — Configure the durable Vercel WAF rate-limit rule in Log mode

**External firewall/billing gate:** current Vercel rate-limiting pricing/account terms must be shown and explicit authorization obtained before publishing a potentially billable rate-limit configuration.

Planned exact rule from 6B:

- path/target: only `POST /api/research`;
- source key: IP on the selected plan;
- fixed window: 60 seconds;
- threshold: 20 requests/source/window;
- initial action: Log/observe;
- enforcement follow-up: Rate Limit -> default 429.

Steps:

- [ ] inspect existing firewall custom rules so a Hobby-plan single-rule limit or precedence conflict is not accidentally overwritten;
- [ ] if an existing unrelated rule would be displaced, stop and redesign rather than deleting it;
- [ ] publish exact Log-mode rule;
- [ ] verify it matches intended Production/Preview scope per current platform semantics;
- [ ] record rollback/disable procedure;
- [ ] do not broaden to all routes.

Do not claim abuse protection complete while the rule is only Log mode.

---

## Task 10 — Create an authorized Preview deployment

**External deployment gate:** confirm explicit authorization to deploy Preview from the exact candidate source.

Before deploy:

- [ ] record current Git commit if committed, or explicitly state if deploying an uncommitted local working tree; for final release prefer an exact committed candidate for traceability;
- [ ] verify secret scan and all local gates are green;
- [ ] verify no protected/private file is in deployment source;
- [ ] verify intended Vercel project/scope.

Deploy Preview with the Vercel CLI using the existing project link.

After deploy:

- [ ] use `vercel inspect`/equivalent to confirm ready status/build revision/config;
- [ ] do not promote to Production yet;
- [ ] record Preview URL as test-only, not Devpost URL.

If build fails, fix locally and produce a new Preview. Do not mutate project settings randomly to bypass build errors.

---

## Task 11 — Preview deployment security/functional acceptance

Run browser/HTTP checks against the exact Preview deployment.

### Route/headers
- [ ] Home/Research/Compare/Guide/auth/saved expected status;
- [ ] HTTPS/TLS valid;
- [ ] canonical/preview host behavior understood;
- [ ] nonce CSP present and unique between HTML requests;
- [ ] production script CSP lacks dev unsafe directives;
- [ ] static security headers correct;
- [ ] do not treat Preview/local app headers as HSTS evidence; current Vercel platform HSTS is verified only against the final canonical production HTTPS response;
- [ ] server/framework disclosure absent as intended.

### Anonymous modes
- [ ] Research fixture/seed path if Preview is not authorized for live providers;
- [ ] Compare 2–4 target fixture flow;
- [ ] Guide invented profile flow;
- [ ] no critical console/page errors;
- [ ] responsive/keyboard spot checks.

### Auth/save if enabled in Preview
- [ ] Magic Link callback allowed only for exact Preview redirect;
- [ ] session refresh + CSP coexist;
- [ ] save/list/load/delete private artifact;
- [ ] cross-user isolation;
- [ ] no private marker in URL/Web Storage/provider-bound requests.

### Platform error handling
- [ ] injected/test route mechanism or non-provider test seam verifies app handles 429/504 safely without intentionally triggering billable live providers;
- [ ] application whole-run deadline tests remain local unless a bounded preview simulation is available.

Any blocker returns to local fix -> full affected gates -> new Preview.

---

## Task 12 — Observe WAF Log rule with normal judge flow

Using Preview or a safe production-equivalent scope supported by current Vercel firewall behavior:

- [ ] execute one normal Research + four-target Compare + Guide + one refresh/retry sequence using deterministic/authorized inputs;
- [ ] observe rate-limit log counters/traffic without recording source IP in public docs;
- [ ] prove normal flow stays comfortably below 20/60 seconds;
- [ ] inspect whether framework/prefetch/internal requests unexpectedly match the rule; they must not because method/path are exact;
- [ ] assess shared-NAT risk and whether 20 is too low/high based on actual request pattern;
- [ ] if threshold changes, update spec/tests/docs and justify it before enforcement.

Do not generate abusive traffic to test the threshold; a small bounded synthetic request set is enough if requests are blocked before provider work or provider calls are fixture-disabled.

---

## Task 13 — Promote WAF rule from Log to enforced rate limit

**External/billable firewall mutation gate:** obtain explicit authorization for the exact final rule/threshold/action.

- [ ] change only the reviewed UniProof rule;
- [ ] action: Rate Limit, default 429 follow-up;
- [ ] publish;
- [ ] verify normal requests pass;
- [ ] perform a bounded over-threshold test that is intercepted before expensive provider work where possible;
- [ ] verify 429 reaches Research client as the stable sanitized rate-limit error and no browser retry storm occurs;
- [ ] verify rule is visible/active and record rollback.

Public deployment remains blocked if durable rate limiting cannot be activated.

---

## Task 14 — Production deployment authorization and release

**External production deployment gate:** obtain explicit authorization to deploy/promote the exact verified candidate.

Before action:

- [ ] Preview passed all gates;
- [ ] WAF enforcement active/verified or exact activation ordering is safe;
- [ ] Supabase migrations/RLS/Auth are verified if auth is enabled;
- [ ] Production env variable names/scopes complete;
- [ ] exact candidate commit/source identified;
- [ ] rollback deployment ID/candidate known.

Deploy/promote to Production.

After action:

- [ ] inspect deployment status/build logs sanitized;
- [ ] verify canonical production URL and HTTPS;
- [ ] verify Preview URL is not accidentally canonical/Devpost target;
- [ ] verify production environment selected, not Preview env.

---

## Task 15 — Production TLS/HSTS/CSP/security-header verification

Against the final canonical production origin:

- [ ] TLS certificate/hostname valid;
- [ ] HTTP -> HTTPS/canonical redirects correct if an HTTP endpoint is platform-exposed;
- [ ] observe the actual Vercel-delivered HSTS header on the final canonical HTTPS origin; current platform documentation expects `Strict-Transport-Security: max-age=63072000`, but record the deployed response rather than hard-coding a local claim;
- [ ] verify UniProof did not add a conflicting application HSTS value, `includeSubDomains`, or `preload`; if hosting behavior differs from the current Vercel documentation, stop and document/review the actual platform policy rather than claiming ownership of the parent `vercel.app` domain;
- [ ] nonce CSP correct on actual HTML and nonce changes per request;
- [ ] production CSP lacks `unsafe-eval` and script `unsafe-inline`;
- [ ] auth `Set-Cookie` and CSP both survive same response where refresh occurs;
- [ ] no user-specific response cached/shared;
- [ ] frame/referrer/content-type/permissions headers expected;
- [ ] no third-party analytics/script requests.

Treat any cross-user cache/session or CSP failure as critical rollback/blocker.

---

## Task 16 — Authorized bounded live-provider smoke

**External quota/data-processing gate:** explicitly authorize the exact small live smoke before enabling/calling providers.

Use public university/program context only and the normal provider order. Never use a real applicant profile.

Budget:

- [ ] one representative end-to-end live Research run on one supported program;
- [ ] no deliberate provider failure/fallback triggering;
- [ ] inspect returned evidence/source lifecycle and sanitization;
- [ ] one 3-target Compare may use normal Research calls only if explicitly included in the authorized quota budget; otherwise verify Compare from already validated fixture/saved safe results;
- [ ] Guide uses invented applicant marker and one normal Research request if not already covered;
- [ ] one client cancellation only if it can be done early without intentionally wasting multiple provider requests;
- [ ] no more calls merely to chase non-deterministic content once the smoke objective is satisfied.

Verify:

- public inputs only reach provider path;
- no applicant marker/account email/private artifact enters requests/logs;
- sources open/resolve safely without automated external navigation in test harness;
- provider/model/internal history remains server-side;
- result can degrade truthfully if provider quota/config fails.

Do not publish raw provider request/response bodies as acceptance evidence.

---

## Task 17 — Production auth/save/delete smoke with invented private data

Only if production auth is enabled and configured.

- [ ] sign in with invented test email through real production Magic Link delivery;
- [ ] verify redirect origin allowlist and session continuity;
- [ ] save a small invented profile;
- [ ] save one Research/Compare/Guide snapshot if within payload bounds;
- [ ] list/load exact artifacts across a fresh browser context/session to prove hosted persistence/cross-device semantics;
- [ ] verify User B cannot access User A by ID;
- [ ] signout clears private UI and later private API rejects;
- [ ] delete exact smoke artifacts;
- [ ] delete/disable exact smoke users if authorized and verify no test residue.

Never use a real student/applicant account for this proof.

---

## Task 18 — Full deployed browser acceptance and responsiveness

Run the core deployed matrix with production-safe request budget:

- [ ] Home navigation;
- [ ] Research success/partial/error presentation using bounded live/fixture approach appropriate to production;
- [ ] Compare 2/3/4 target UI, coverage/suppression/evidence;
- [ ] Guide six-state representative UI and privacy marker;
- [ ] auth/Saved if enabled;
- [ ] source/evidence/official links validated without uncontrolled external navigation;
- [ ] keyboard flow;
- [ ] reduced motion;
- [ ] 320x740, 375x812, 390x844, 768x1024, 1024x768, 1440x900 smoke coverage;
- [ ] no critical console/page errors;
- [ ] no CSP violations;
- [ ] no unexpected browser external requests.

Do not repeat expensive live Research for every viewport; reuse verified safe state/fixture/deployed deterministic paths where possible. The purpose is UI/deployment verification, not quota consumption.

---

## Task 19 — Production secret/privacy/log/artifact audit

- [ ] scan deployed client JS/static/source maps for provider/server secret names and configured secret values without printing values;
- [ ] scan source/release assets for `.env`, auth storage state, cookies/tokens, DB passwords/URLs with passwords, private invented marker leakage;
- [ ] inspect Vercel logs only for sanitized operational metadata; no raw prompt/source/profile/secret bodies;
- [ ] inspect Supabase logs/policies as needed without publishing identifiers/tokens;
- [ ] verify Release screenshot path contains no private data;
- [ ] verify protected `ui-flow-screenshots/` unchanged.

If any secret value is exposed, stop publication, remove the exposed copy, assess/perform credential rotation only with explicit authorization, then rebuild/redeploy and repeat scans.

---

## Task 20 — Bind tested Production deployment to exact Git source

Before public repo/release claim:

- [ ] identify exact source tree/commit used for Production;
- [ ] if Production was deployed from uncommitted changes, do not proceed to final submission until an exact equivalent committed source is created/tested/deployed or otherwise cryptographically/procedurally proven equivalent;
- [ ] compare production deployment metadata/build revision with intended commit where Vercel exposes it;
- [ ] final local diff/secret scan must match publication scope.

The Devpost repository must allow judges to inspect the code that corresponds to the deployed product.

---

## Task 21 — GitHub publication/CI gate

**External Git mutation gate:** commit/push/PR/merge/release only after explicit authorization.

Before publication:

- [ ] verify remote URL is `PracticalSwan/UniProof` or the explicitly intended destination;
- [ ] inspect branch/status/staged diff and unrelated changes;
- [ ] stage only intended Phase 4–6/release files;
- [ ] secret scan exact staged set;
- [ ] verify no `.vercel/`, Supabase local generated secret, auth cookie/storage state, Playwright private trace, `.env*`, or unintended large artifact is staged;
- [ ] verify LICENSE and open-source status;
- [ ] verify public repository visibility read-only first; do not change visibility unless explicitly authorized.

After authorized push:

- [ ] verify remote commit SHA/content;
- [ ] observe GitHub Actions CI on exact commit;
- [ ] if CI fails, fix/retest/push a new authorized change rather than ignoring required checks;
- [ ] account for any Vercel Git integration auto-deploy triggered by push and verify whether it changed Production from the already tested deployment.

Do not create a GitHub Release/tag unless it serves a real submission need and is explicitly authorized.

---

## Task 22 — Prepare verified README and architecture/release documentation

Only after Production/live behavior exists.

Update README with observed facts:

- [ ] concise problem/value proposition;
- [ ] Research/Compare/Guide description;
- [ ] evidence-first architecture diagram/explanation;
- [ ] AI role versus deterministic gates;
- [ ] provider fallback order as actually deployed;
- [ ] optional auth/save behavior as actually enabled;
- [ ] privacy statement accurately distinguishes public provider inputs and optional private Supabase snapshots;
- [ ] local setup/test commands including Supabase local workflow if relevant;
- [ ] live Production URL;
- [ ] release screenshots from verified deployment;
- [ ] known scope limits/no admission guarantee.

Do not claim formal security certification, universal university coverage, guaranteed current data, zero provider cost, or provider behavior not observed/sourced.

---

## Task 23 — Capture release screenshots safely

**Create:** `docs/assets/screenshots/phase-6/` only after Production is verified.

Capture at least:

- [ ] Research evidence/result;
- [ ] Compare weights + coverage/fit + evidence/trade-off;
- [ ] Guide mixed assessment + checklist/timeline/evidence;
- [ ] mobile/responsive view.

Before retaining each image:

- [ ] invented applicant data only;
- [ ] no account email unless explicitly intended and synthetic;
- [ ] no auth/session/token/address-bar sensitive query;
- [ ] no DevTools/private terminal/notifications/unrelated tabs;
- [ ] no misleading stale/broken UI;
- [ ] image corresponds to final deployed behavior.

Never overwrite `ui-flow-screenshots/`.

---

## Task 24 — Prepare the approximately three-minute demo package

**Create:**
- `docs/submission/demo-script.md`
- `docs/submission/demo-checklist.md`

Script target:

- 0:00–0:20 problem and evidence-first thesis;
- 0:20–1:05 Research + exact evidence/source + unknown/conflict behavior;
- 1:05–1:45 Compare 3 programs + priorities + coverage/fit-not-ranking + trade-off evidence;
- 1:45–2:30 Guide invented applicant + six-state result + risk/checklist/timeline + no admission probability;
- 2:30–2:50 AI architecture: public-source extraction/semantic reconciliation, deterministic evidence gates;
- 2:50–3:00 privacy/failure/deployed URL close.

- [ ] Keep demo under/around the event's recommended ~3 minutes.
- [ ] Show meaningful AI integration, not merely UI.
- [ ] Use a deterministic rehearsed path; avoid relying on a slow/new live Research run during the entire recording.
- [ ] If using a saved verified snapshot, label it truthfully and show a live source/evidence interaction.
- [ ] No private/secret data visible.
- [ ] Verify final video link visibility before submission.

Video recording/upload itself is an external/publication action if uploaded to a service and requires the applicable authorization.

---

## Task 25 — Re-check Devpost immediately before filling/submitting

Use the live Devpost event pages, not only `docs/hackathon.md`.

Record current:

- [ ] event title/prize text;
- [ ] submission deadline with timezone conversion to Bangkok;
- [ ] participant/team eligibility;
- [ ] open-source requirement;
- [ ] hosted URL requirement;
- [ ] license requirement;
- [ ] demo video requirement/recommendation;
- [ ] submission form fields;
- [ ] judging criteria;
- [ ] any new sponsor/API/track requirement.

As of the planning check on 2026-08-19, the public page showed `$13,000+ in Prizes`; submissions end 2026-08-22 21:30 IST = 16:00 UTC = 23:00 Bangkok. Treat both as mutable until this task runs.

Update `docs/hackathon.md` from the live check before final submission.

---

## Task 26 — Draft the exact Devpost submission for user review

**Create:** `docs/submission/devpost-draft.md`

Include only verified facts:

- project name/tagline;
- problem;
- solution and three modes;
- meaningful AI use;
- evidence/provenance/conflict behavior;
- technologies;
- challenges/lessons;
- accomplishments;
- what is next (clearly post-hackathon);
- public repository URL;
- Production URL;
- demo video URL;
- screenshot/media selection;
- open-source license.

- [ ] no unverified benchmark/coverage/security claim;
- [ ] no promise of admission accuracy/probability;
- [ ] no private user/account info;
- [ ] no provider secret/project admin link;
- [ ] distinguish current functionality from future roadmap.

Present the exact draft/URLs to the user before final submission.

---

## Task 27 — Final release audit on exact submitted artifacts

Before asking for final Devpost authorization:

- [ ] Production URL healthy;
- [ ] exact GitHub repo public and exact commit CI green;
- [ ] LICENSE visible;
- [ ] README images/links load;
- [ ] demo video accessible without private permission;
- [ ] WAF rate limit active;
- [ ] auth/save production state accurately documented;
- [ ] no critical console/server errors in final smoke;
- [ ] current provider/live mode operational enough for judges, with truthful partial behavior if quota fails;
- [ ] no exposed secrets/private markers;
- [ ] Devpost draft matches live product;
- [ ] deadline still open.

If Production changed after the last audit, rerun the affected gates before submission.

---

## Task 28 — Devpost submission only after final explicit authorization

**External publication/submission gate:** do not click/execute final submission without an explicit user instruction approving the exact reviewed submission.

When authorized:

- [ ] verify logged-in Devpost account/team is correct;
- [ ] enter the approved fields/URLs only;
- [ ] preview/review for formatting and broken links;
- [ ] submit once;
- [ ] verify confirmation/status page and submitted project visibility;
- [ ] do not create duplicate submissions to recover from uncertainty;
- [ ] record confirmation time/status, not private session details.

If Devpost rejects/changes a field, stop before materially changing project claims and obtain user input if the change affects content/representation.

---

## Task 29 — Post-submission verification and rollback posture

After successful authorized submission:

- [ ] re-open submitted Devpost project publicly if possible;
- [ ] verify Production and repo links still resolve;
- [ ] preserve the verified Production deployment/commit during judging;
- [ ] avoid unnecessary post-deadline architecture/provider changes;
- [ ] if a critical security/privacy defect is discovered, prioritize user safety: document, fix, redeploy only with authorization, and update submission if Devpost permits;
- [ ] monitor provider quota/service availability only if the user asks for ongoing monitoring; do not create background polling silently.

---

## Task 30 — Final documentation/memory closeout

After external state is actually verified, update:

- [ ] `docs/planning/phase-6-hardening-submission-readiness.md` final status/evidence;
- [ ] `docs/planning/tasks.md` Phase 6 checkboxes;
- [ ] `docs/planning/phase-6-requirements-traceability.md` live statuses;
- [ ] `docs/hackathon.md` final live verification snapshot;
- [ ] `docs/requirements.md` implementation status;
- [ ] `docs/design.md` deployed architecture;
- [ ] `docs/security.md` deployed controls/residual risk;
- [ ] `docs/security-threat-model.md` deployment/auth status;
- [ ] `README.md` live URLs/assets;
- [ ] `CHANGELOG.md`;
- [ ] `AGENT_MEMORY.md` with exact deployment/commit/submission evidence;
- [ ] `LESSONS.md` only for reusable release corrections.

Final report must separately state:

- local verification;
- hosted Supabase verification;
- Preview verification;
- Production verification;
- live-provider smoke count/scope;
- WAF state;
- GitHub commit/CI state;
- Devpost submission state;
- skipped checks/residual risks.

Do not call Phase 6 complete merely because a deployment URL exists. Phase 6 completes only when the Phase 6C completion gate in the canonical spec is satisfied and every claimed external state was actually observed.
