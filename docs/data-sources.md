# UniProof Data Source Policy

## Source Priority

Use the strongest available source for the exact claim and period.

| Tier | Source class | Examples |
| --- | --- | --- |
| 1 | Primary authoritative | Official university/program pages, official fee schedules, government education agencies, accreditation bodies, immigration authorities |
| 2 | Open authoritative datasets | OpenAlex, ROR, College Scorecard, Discover Uni, government statistics |
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
- **OpenAlex:** research works, topics, authors, and institution-level research activity.
- **ROR:** canonical research-organization identities and identifiers.
- **College Scorecard:** US institution-level public education/outcome data where applicable.
- **Discover Uni:** UK course and outcome information where applicable.
- **Tavily:** bounded source discovery and retrieval support, not an authority by itself.

Provider use must be re-checked against current documentation, API terms, licensing, and rate limits before implementation.

## Conflict and Freshness Rules

- Keep multiple credible values when sources disagree.
- Compare effective dates, academic years, and source authority before recommending a preferred value.
- Never merge values from different programs, campuses, degree levels, or academic years without an explicit normalization rule.
- Mark date-unknown or stale evidence clearly.
- Re-research critical values such as deadlines and fees before a user treats them as application-ready.

## Review/Opinion Rules

Student-review themes are anecdotal evidence. Store date range, source/platform, sample size when known, and theme support. Never convert sentiment into a verified institutional fact.

Do not ingest or redistribute proprietary ranking/review datasets unless the applicable terms permit it. Linking to the authoritative source is preferable when reuse rights are uncertain.
