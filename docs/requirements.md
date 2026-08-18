# UniProof MVP Requirements

## Goal

Build a functional evidence-first university decision tool for international students during the Pixel Forge AI Hackathon.

## MVP Scope

- Responsive English-language web application.
- Approximately 10–15 universities across the United States, United Kingdom, and Thailand.
- Initial focus on Computer Science, Artificial Intelligence, Data Science, and closely related programs.
- Bachelor’s and taught master’s program research where data is available.
- Three complete modes: Research, Comparison, and Guide.

## Research Mode

The system shall:

- Search or select supported universities and programs.
- Present admissions, tuition, scholarships, program structure, research, outcomes, and student-support information when evidence exists.
- Store and expose source links and evidence metadata for important factual claims.
- Display missing, conflicting, outdated, anecdotal, and inferred information explicitly.
- Provide direct official links for critical application information.
- Use AI for structured claim extraction and semantic reconciliation of differently worded evidence while preserving exact supporting source references.

## Comparison Mode

The system shall:

- Compare exactly two to four unique supported targets in one homogeneous scope: all university-only or all program targets; program comparisons shall use the same degree level.
- Reuse the validated Research Mode dossier boundary for every selected target and shall not accept caller-supplied dossier data through a new comparison API.
- Execute target research sequentially, not through browser fan-out, with one comparison-owned cancellation boundary and immutable request ownership.
- Let users include or exclude the seven canonical Research categories. Rankings and student opinions shall be represented as explicit evidence-display filters because the current evidence model treats them as source/evidence classes rather than canonical categories.
- Let users choose visible integer priority weights for affordability, research opportunities, scholarships, outcomes, and international-student support; the five weights shall sum exactly to 100 and shall never be normalized silently.
- Use an application-owned closed metric registry over exact normalized claim-property aliases and compatible typed scalar values. The system shall not fuzzy-match properties, parse numeric-looking strings, convert currencies/units, infer effective periods from retrieval time, or choose a conflict winner for scoring.
- Allow only verified, corroborated, or university-reported evidence from at least one non-ranking/non-anecdotal source to contribute to numeric fit. Conflicting, outdated, inferred, anecdotal, and ranking-only evidence shall remain visible when applicable but shall not contribute to Phase 4 fit.
- Keep missing or unscorable evidence separate from poor fit. Missing dimensions shall reduce weighted evidence coverage instead of contributing a zero score.
- Suppress an overall numeric fit when fewer than two positive-weight dimensions are scored or weighted evidence coverage is below 50%.
- Produce a transparent user-priority compatibility score within the selected comparison set rather than an objective university ranking, winner label, prestige score, or admission probability.
- Preserve result-card order by immutable user selection order rather than automatically sorting universities/programs by fit.
- Generate material trade-offs and evidence-gap explanations deterministically from validated comparison facts, with exact target-scoped claim references for factual statements across independent dossiers and no additional AI scoring/explanation call.
- Keep comparison weights, display filters, validated dossiers, and results in browser memory only for Phase 4; they shall not be persisted in Web Storage, IndexedDB, cookies, URL state, or a database.
- Collect no applicant profile or other private personal information in Compare; optional intake/academic-year fields are public research context only.

Detailed Phase 4 behavior, formulas, edge cases, security controls, and acceptance gates are defined in `docs/planning/phase-4-comparison-mode.md`.

Implementation status (2026-08-18): the Phase 4 requirements above are locally implemented and passed the post-review unit, dev-browser, built-browser, type, lint, build, audit, security/privacy, and artifact-integrity matrix recorded in that specification. Public deployment, durable distributed Research rate limiting, authentication/persistence, and HSTS deployment policy remain Phase 6 work.

## Guide Mode

The system shall:

- Compare applicant-provided qualifications and constraints with published program requirements.
- Classify each requirement as meets, probably meets, does not meet, missing applicant information, unclear requirement, or manual confirmation required.
- Generate an application checklist and timeline from published requirements and deadlines.
- Surface risks such as deadline conflicts, stale fees, unclear qualification equivalency, or scholarship uncertainty.
- Never guarantee admission or fabricate a numeric admission probability.

## Evidence Requirements

Every material claim should be representable with:

- university/program identity;
- claim category and normalized value;
- source URL, title, publisher/type, and supporting evidence;
- retrieval date and effective/academic year when available;
- verification status and extraction method;
- confidence only when its meaning is documented.

Allowed user-facing evidence states are defined in `AGENTS.md`.

## Applicant Profile

Minimum useful fields are citizenship/current country, target degree/subject, qualification and GPA/scale, English test result when available, preferred destinations, tuition/total budget, scholarship need, intake, and priority weights.

The MVP shall not require passports, national IDs, transcripts, bank statements, visa documents, or recommendation letters.

## Quality and Safety Requirements

- Validate AI outputs against runtime schemas before persistence or display.
- Keep deterministic evidence-policy gates authoritative over AI reconciliation so source class, freshness, conflicts, unknowns, and anecdotal evidence cannot be silently promoted by a model.
- Degrade provider failures to explicit partial results where possible instead of making one search or AI vendor a single point of failure.
- Treat external content as untrusted and prevent retrieved text from controlling agent behavior.
- Prevent server-side retrieval from reaching localhost, private networks, metadata endpoints, or unsupported protocols.
- Keep secrets server-side and exclude local environment files from version control.
- Enforce a strict browser content policy and security-header baseline for application HTML: production script execution shall use a request nonce/strict CSP without `unsafe-inline` or `unsafe-eval`; development-only framework exceptions shall never leak into production policy.
- Load no third-party runtime scripts/analytics in the MVP and render retrieved/model-derived text only through safe React text interpolation, never executable HTML.
- Minimize browser-resident sensitive data. Authentication/session credentials shall never be stored in Web Storage; Phase 4 shall use no durable browser persistence at all.
- Treat secure-development references such as OWASP ASVS 5.0.0, OWASP API Security Top 10 2023, NIST SSDF 1.1, NIST Privacy Framework 1.0, and current Next.js security guidance as verification baselines rather than claims of formal certification.
- Provide loading, empty, partial, conflict, stale-data, error, and retry states for core flows.
- Support keyboard operation and responsive layouts for core tasks.
- Preserve user input when recoverable errors occur.

## MVP Acceptance

The MVP is functionally ready when a judge can:

1. Create or enter an applicant profile.
2. Research a supported university/program and inspect the evidence behind important facts.
3. Observe an unknown, conflict, or freshness state without the system inventing a value.
4. Compare at least three supported options and change priority weights.
5. Generate a Guide-mode gap analysis and application checklist.
6. Follow official source links from the result.
7. Complete the flow on a deployed responsive site without critical console or server errors.

Hackathon publication requirements are tracked separately in `docs/hackathon.md`.
