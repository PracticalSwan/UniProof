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

## Comparison Mode

The system shall:

- Compare two to four universities or programs.
- Let users include or exclude categories such as rankings and student opinions.
- Let users choose priority weights for affordability, research, scholarships, outcomes, and other supported categories.
- Produce a transparent user-fit score rather than an objective university ranking.
- Explain material trade-offs and evidence gaps behind the comparison.

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
- Treat external content as untrusted and prevent retrieved text from controlling agent behavior.
- Prevent server-side retrieval from reaching localhost, private networks, metadata endpoints, or unsupported protocols.
- Keep secrets server-side and exclude local environment files from version control.
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
