# UniProof Data Source Policy

## Source Priority

Use the strongest available source for the exact claim and period.

| Tier | Source class | Examples |
| --- | --- | --- |
| 1 | Primary authoritative | Official university/program pages, official fee schedules, government education agencies, accreditation bodies, immigration authorities |
| 2 | Open authoritative datasets | ROR, College Scorecard, Discover Uni, government statistics |
| 3 | Reputable independent sources | Established education publications, professional associations, major reporting used only when primary evidence is insufficient |
| 4 | Rankings | QS, THE, ARWU, or other providers, subject to licensing and methodology constraints |
| 5 | Student opinion | Review platforms, forums, public community discussions, alumni/student accounts |

Rankings and student opinions are optional product inputs. They must never silently override primary evidence.

## Required Source Metadata

Store, when available:

- canonical URL;
- page/source title;
- publisher or owning organization;
- source class/tier;
- publication or update date;
- effective date or academic year;
- retrieval timestamp;
- relevant supporting text or structured field;
- provider-specific stable identifier;
- licensing/redistribution notes when data is persisted or displayed.

## Initial Provider Roles

- **Official university and government pages:** admissions, deadlines, tuition, scholarships, program rules, application links, and country-specific requirements.
- **ROR:** canonical research-organization identities and identifiers. The Phase 2 discovery adapter uses current v2 affiliation matching, accepts only an active compatible `chosen:true` organization, takes the canonical institution name from the `ror_display` name, and trusts only `links.type=website` as an official-site candidate; Wikipedia links are never promoted as official university URLs.
- **College Scorecard:** US institution-level public education/outcome data where applicable.
- **Discover Uni:** UK course and outcome information where applicable.
- **Tavily:** primary bounded general-web source discovery, not an authority by itself.
- **Brave Search API:** independent-index fallback when Tavily is unavailable or its bounded quota/retries are exhausted; use search results to identify underlying publisher URLs rather than treating Brave as the evidence authority.

Provider use must be re-checked against current documentation, API terms, licensing, privacy behavior, and rate limits before implementation. Discovery failover is sequential: Tavily -> Brave Search -> direct/structured providers. Phase 2F distinguishes a completed general-web query from degraded salvage: if Tavily fails but Brave completes (including a clean empty result), discovery may still complete; if both Tavily and Brave fail/unavailable, validated direct/ROR sources are retained as degraded provenance but the category remains operationally incomplete and is not eligible for a final evidence decision or category-level `unknown`. Clean bounded absence is valid only after the required general-web and bounded supplement work completed. Search queries must contain public research context only, not applicant profile or sensitive personal data.

## Supported Research Catalog

The checked-in catalog under `lib/research/catalog/` contains public identity and navigation metadata only. It currently identifies 10 universities and 14 verified computing programs across the United States, United Kingdom, and Thailand, including 10 bachelor-level and 4 taught-master-level entries. It contains no tuition, deadline, admission-threshold, scholarship, ranking, outcome, or other decision facts.

Catalog university names, countries, official homepages, program names, degree levels, subject labels, and canonical official program URLs were checked against the owning university's official pages on 2026-08-17. Prefer stable current canonical course routes over year-specific archived routes when the university publishes both; the Phase 3A review replaced superseded year-specific Imperial Computing and UCL Computer Science links with their current stable official course routes. That date verifies catalog identity/navigation only; it is not evidence freshness for any factual research claim. The release process must re-check redirects, program currency, and broken official links before publication.

## Evidence Independence and Authority

Evidence authority is claim-specific. An official university page may directly verify a normative admissions, tuition, deadline, or program rule, while a university-originated self-reported outcome/marketing claim may remain `university-reported` until independently supported.

`corroborated` requires materially equivalent support from at least two reliable non-anecdotal/non-ranking sources with distinct owning organizations and independent underlying evidence. Mirrored pages, syndication, copied press releases, or two interfaces over the same originating dataset do not count as independent corroboration. Phase 2E assesses independence conservatively from application-owned provenance: identical content/source identity is one origin and the same normalized publisher is one owner. A `sourceType="university"` page counts as the resolved university only when ownership is established from the resolved official host or a normalized publisher identity that names the resolved university; those established official pages remain one owner across departmental labels, hosts, or subdomains. A different hostname or a generic `university` source type alone is not proof of target ownership or independence. When target ownership or distinct evidence origin cannot be established safely, the source cannot verify/corroborate the target fact. Direct current in-scope authoritative normative evidence retains `verified` precedence even when independent corroborating evidence also exists.

Scope and period compatibility are prerequisites: evidence for another campus, program, degree level, intake, or academic year cannot verify the requested claim merely because the value looks similar.

## Conflict and Freshness Rules

- Keep multiple credible values when sources disagree.
- Compare effective dates, academic years, and source authority before recommending a preferred value.
- Never merge values from different programs, campuses, degree levels, or academic years without an explicit normalization rule.
- Mark date-unknown or stale evidence clearly.
- Re-research critical values such as deadlines and fees before a user treats them as application-ready.

## Review/Opinion Rules

Student-review themes are anecdotal evidence. Store date range, source/platform, sample size when known, and theme support. Never convert sentiment into a verified institutional fact.

Do not ingest or redistribute proprietary ranking/review datasets unless the applicable terms permit it. Linking to the authoritative source is preferable when reuse rights are uncertain.
