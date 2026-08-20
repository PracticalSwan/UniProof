# University Catalog Expansion — Final Source Freeze

## Purpose

This ledger records the application-owned identity/navigation source freeze used to implement Side Phase UCE. The final implementation verification date is **2026-08-20 (Asia/Bangkok)**.

Catalog verification establishes only supported university/program identity, ownership, scope, and navigation. It does **not** establish freshness or correctness of admissions thresholds, tuition, deadlines, scholarships, outcomes, rankings, or other decision facts. Those remain live Research evidence.

No new `rorId` values were added during this side phase. ROR remains optional in the catalog contract, and the implementation does not guess an institutional ROR identifier from a first/high-score result when the official university/program sources already establish the application-owned identity.

## Final manifest

All 20 approved universities are frozen. The final checked-in catalog contains 30 universities and 45 computing programs: the original 10 universities / 14 programs plus 20 universities / 31 programs below.

### Batch 1

#### University of Toronto — CA — `university-toronto`

- Homepage: `https://www.utoronto.ca/`
- Aliases: `U of T`, `UofT`
- Programs:
  - `program-toronto-computer-science-st-george-bsc` — **Computer Science Admission Category (St. George)** — bachelor — Computer Science — `https://www.artsci.utoronto.ca/future/ready-apply/admission-categories/computer-science`
  - `program-toronto-mscac-artificial-intelligence` — **Applied Computing MScAC — Artificial Intelligence Concentration** — master — Artificial Intelligence — `https://mscac.utoronto.ca/concentrations/ai/`
- Scope decision: the undergraduate target is deliberately labeled as the St. George **admission category**, not a later program-of-study enrollment and not UTM/UTSC. This is the applicant-facing scope UniProof can research without implying that admission to the category and later program enrollment are the same decision.
- Status: **frozen 2026-08-20**.

#### University of Waterloo — CA — `university-waterloo`

- Homepage: `https://uwaterloo.ca/`
- Alias: `Waterloo`
- Programs:
  - `program-waterloo-computer-science-bcs` — **Bachelor of Computer Science** — bachelor — Computer Science — `https://uwaterloo.ca/future-students/programs/computer-science`
  - `program-waterloo-computer-science-mmath` — **Master of Mathematics (Computer Science)** — master — Computer Science — `https://uwaterloo.ca/computer-science/current-graduate-students/overview-degree-programs/master-mathematics-computer-science`
- Scope decision: the undergraduate row is the BCS route, not the separate BMath Computer Science route.
- Status: **frozen 2026-08-20**.

#### Carnegie Mellon University — US — `university-carnegie-mellon`

- Homepage: `https://www.cmu.edu/`
- Alias: `CMU`
- Programs:
  - `program-cmu-artificial-intelligence-bs` — **Bachelor of Science in Artificial Intelligence** — bachelor — Artificial Intelligence — `https://www.cs.cmu.edu/bs-in-artificial-intelligence/`
  - `program-cmu-computer-science-bs` — **Bachelor of Science in Computer Science** — bachelor — Computer Science — `https://www.csd.cmu.edu/academics/bachelors/overview`
- Scope decision: the two SCS degrees remain distinct catalog identities. First-year/major-declaration rules belong to Research evidence rather than catalog facts.
- Status: **frozen 2026-08-20**.

#### Technical University of Munich — DE — `university-tum`

- Homepage: `https://www.tum.de/en/`
- Alias: `TUM`
- Program:
  - `program-tum-informatics-msc` — **Informatics M.Sc.** — master — Informatics — `https://www.cit.tum.de/en/cit/studies/degree-programs/master-informatics/`
- Status: **frozen 2026-08-20**.

#### KTH Royal Institute of Technology — SE — `university-kth`

- Homepage: `https://www.kth.se/en`
- Alias: `KTH`
- Program:
  - `program-kth-computer-science-msc` — **MSc Computer Science** — master — Computer Science — `https://www.kth.se/en/studies/master/computer-science`
- Status: **frozen 2026-08-20**.

### Batch 2

#### University of British Columbia — CA — `university-ubc`

- Homepage: `https://www.ubc.ca/`
- Alias: `UBC`
- Programs:
  - `program-ubc-computer-science-bsc` — **Computer Science Major (BSc)** — bachelor — Computer Science — `https://www.cs.ubc.ca/students/undergrad/degree-programs`
  - `program-ubc-computer-science-msc` — **MSc Computer Science** — master — Computer Science — `https://www.cs.ubc.ca/students/grad/graduate-programs/msc-program`
- Scope decision: the undergraduate row is the BSc major, not the BA or second-degree BCS.
- Status: **frozen 2026-08-20**.

#### McGill University — CA — `university-mcgill`

- Homepage: `https://www.mcgill.ca/`
- Programs:
  - `program-mcgill-computer-science-bsc` — **B.Sc. Major in Computer Science** — bachelor — Computer Science — `https://www.cs.mcgill.ca/academic/undergrad/bsc/`
  - `program-mcgill-computer-science-msc-non-thesis` — **M.Sc. Computer Science (Non-Thesis)** — master — Computer Science — `https://www.mcgill.ca/gradapplicants/program/computer-science-msc-non-thesis`
- Scope decision: the graduate row uses McGill's current applicant-facing non-thesis/course-based MSc route rather than treating thesis/non-thesis as an unspecified post-admission switch.
- Status: **frozen 2026-08-20**.

#### University of Illinois Urbana-Champaign — US — `university-uiuc`

- Homepage: `https://illinois.edu/`
- Aliases: `UIUC`, `Illinois`
- Programs:
  - `program-uiuc-computer-science-bs` — **B.S. in Computer Science** — bachelor — Computer Science — `https://siebelschool.illinois.edu/academics/undergraduate/degree-program-options/bs-computer-science`
  - `program-uiuc-computer-science-mcs` — **Master of Computer Science in Urbana-Champaign** — master — Computer Science — `https://siebelschool.illinois.edu/academics/graduate/professional-mcs/campus-master-computer-science`
- Scope decision: do not substitute CS+X or the combined BS-MCS for these rows.
- Status: **frozen 2026-08-20**.

#### Delft University of Technology — NL — `university-tu-delft`

- Homepage: `https://www.tudelft.nl/en/`
- Alias: `TU Delft`
- Program:
  - `program-tu-delft-computer-science-msc` — **MSc Computer Science** — master — Computer Science — `https://www.tudelft.nl/onderwijs/opleidingen/masters/cs/msc-computer-science/`
- Source-resolution note: TU Delft's own programme page returns HTTP 403 to the research crawler, so the final exact route was corroborated through the current TU Delft Computer Science/Applied Mathematics study association page, whose “MSc Computer Science” link resolves to that `www.tudelft.nl` URL, plus TU Delft OpenCourseWare/faculty material confirming the MSc Computer Science programme. The catalog stores the official TU Delft URL, not the association/OCW page.
- Status: **frozen 2026-08-20**.

#### Aalto University — FI — `university-aalto`

- Homepage: `https://www.aalto.fi/en`
- Program:
  - `program-aalto-machine-learning-data-science-artificial-intelligence-msc` — **Machine Learning, Data Science and Artificial Intelligence, Master of Science (Technology)** — master — Artificial Intelligence and Data Science — `https://www.aalto.fi/en/study-options/machine-learning-data-science-and-artificial-intelligence-master-of-science-technology`
- Scope decision: the catalog preserves the official study-option/degree hierarchy instead of inventing a new degree-level enum.
- Status: **frozen 2026-08-20**.

### Batch 3

#### University of Alberta — CA — `university-alberta`

- Homepage: `https://www.ualberta.ca/`
- Alias: `UAlberta`
- Program:
  - `program-alberta-computing-science-multimedia-msc` — **Master of Science (Course-Based) in Computing Science, Multimedia** — master — Computing Science — `https://www.gsa.ualberta.ca/en/computing-science/graduate-studies/programs-and-admissions/multimedia.html`
- Scope decision / plan revision: planning initially proposed an undergraduate Computing Science target, but a current applicant-facing main-campus undergraduate route could not be frozen without relying on archived/administrative material. The implementation therefore follows the plan's fail-closed replacement rule and uses the current official Computing Science page that explicitly instructs applicants to select **Master of Science (Crse) in Computing Science, Multimedia**. No undergraduate row was guessed.
- Status: **frozen 2026-08-20**.

#### Cornell University — US — `university-cornell`

- Homepage: `https://www.cornell.edu/`
- Programs:
  - `program-cornell-computer-science-bs` — **Computer Science, B.S. (Engineering)** — bachelor — Computer Science — `https://catalog.cornell.edu/programs/computer-science-bs/`
  - `program-cornell-computer-science-meng` — **Computer Science, M.Eng.** — master — Computer Science — `https://catalog.cornell.edu/programs/computer-science-cscn-meng/`
- Scope decision: the undergraduate row is explicitly Engineering B.S., not the Arts & Sciences B.A.; the graduate row is MEng rather than the research M.S.
- Status: **frozen 2026-08-20**.

#### University of California San Diego — US — `university-ucsd`

- Homepage: `https://ucsd.edu/`
- Aliases: `UC San Diego`, `UCSD`
- Programs:
  - `program-ucsd-artificial-intelligence-bs` — **B.S. Artificial Intelligence** — bachelor — Artificial Intelligence — `https://cse.ucsd.edu/undergraduate/bs-artificial-intelligence-cse-bs-004`
  - `program-ucsd-computer-science-bs` — **B.S. Computer Science** — bachelor — Computer Science — `https://cse.ucsd.edu/undergraduate/bs-computer-science-cse-bs-002`
  - `program-ucsd-computer-science-ms` — **M.S. Computer Science** — master — Computer Science — `https://cse.ucsd.edu/graduate/degree-programs/ms-program`
- Scope decision: current-year curriculum/policy wording remains Research evidence; the catalog stores only the current program identities/navigation.
- Status: **frozen 2026-08-20**.

#### KU Leuven — BE — `university-ku-leuven`

- Homepage: `https://www.kuleuven.be/english/`
- Program:
  - `program-ku-leuven-artificial-intelligence-master` — **Master of Artificial Intelligence** — master — Artificial Intelligence — `https://www.kuleuven.be/opleidingen/programmes/master-artificial-intelligence`
- Scope decision: KU Leuven describes this as an advanced master's programme, but UniProof retains the existing application-owned `master` degree-level enum. Advanced-master prerequisites/status remain Research/Guide evidence.
- Status: **frozen 2026-08-20**.

#### University of Amsterdam — NL — `university-amsterdam`

- Homepage: `https://www.uva.nl/en/`
- Alias: `UvA`
- Program:
  - `program-amsterdam-artificial-intelligence-msc` — **MSc Artificial Intelligence** — master — Artificial Intelligence — `https://www.uva.nl/shared-content/programmas/en/masters/artificial-intelligence/artificial-intelligence.html`
- Status: **frozen 2026-08-20**.

### Batch 4

#### University of Michigan–Ann Arbor — US — `university-michigan`

- Homepage: `https://umich.edu/`
- Aliases: `UMich`, `Michigan`
- Programs:
  - `program-michigan-computer-science-engineering-bs` — **Computer Science Major (Engineering)** — bachelor — Computer Science — `https://cse.engin.umich.edu/academics/undergraduate/majors/computer-science-eng-major/`
  - `program-michigan-computer-science-engineering-ms` — **Master's in Computer Science and Engineering** — master — Computer Science and Engineering — `https://cse.engin.umich.edu/academics/graduate/graduate-programs/masters-in-cse/`
- Scope decision: the undergraduate row is explicitly the College of Engineering route and is not merged with LSA Computer Science.
- Status: **frozen 2026-08-20**.

#### University of Washington, Seattle — US — `university-washington`

- Homepage: `https://www.washington.edu/`
- Alias: `UW Seattle`
- Program:
  - `program-washington-computer-science-bs` — **B.S. Computer Science (Seattle)** — bachelor — Computer Science — `https://www.cs.washington.edu/academics/undergraduate/admissions/`
- Scope decision: Seattle campus is explicit. Bare `UW` is intentionally absent because it is ambiguous with Waterloo/other institutions. Admission-path specifics remain Research evidence.
- Status: **frozen 2026-08-20**.

#### Technical University of Denmark — DK — `university-dtu`

- Homepage: `https://www.dtu.dk/english/`
- Alias: `DTU`
- Program:
  - `program-dtu-computer-science-engineering-msc` — **Master of Science in Engineering (Computer Science and Engineering)** — master — Computer Science and Engineering — `https://www.dtu.dk/english/education/graduate/msc-programmes/computer-science-and-engineering`
- Status: **frozen 2026-08-20**.

#### Politecnico di Milano — IT — `university-polimi`

- Homepage: `https://www.polimi.it/en/`
- Alias: `Polimi`
- Program:
  - `program-polimi-computer-science-engineering-msc` — **Computer Science and Engineering** — master — Computer Science and Engineering — `https://www.polimi.it/en/education/laurea-magistrale-programmes/programme-detail/computer-science-and-engineering`
- Status: **frozen 2026-08-20**.

#### RWTH Aachen University — DE — `university-rwth-aachen`

- Homepage: `https://www.rwth-aachen.de/`
- Alias: `RWTH`
- Programs:
  - `program-rwth-aachen-data-science-msc` — **Data Science M.Sc.** — master — Data Science — `https://sc.informatik.rwth-aachen.de/en/studium/master/master-data-science/`
  - `program-rwth-aachen-human-centered-intelligent-systems-msc` — **Human-Centered Intelligent Systems M.Sc.** — master — Artificial Intelligence — `https://sc.informatik.rwth-aachen.de/en/studium/master/master-hcis/`
- Scope decision: these current English-facing Computer Science faculty programmes remain distinct from materially different CS/private-business-school offerings.
- Status: **frozen 2026-08-20**.

## Existing-catalog navigation correction

### Massachusetts Institute of Technology — US — `university-mit`

The pre-UCE catalog used `https://web.mit.edu/` as the application-owned university homepage while the existing MIT program routes live under `catalog.mit.edu`. Current MIT institutional navigation uses `https://www.mit.edu/`.

UCE changes only `university-mit.websiteUrl` to `https://www.mit.edu/`. All MIT university/program IDs, program ownership, and evidence/source URLs remain unchanged. Combined with the regression-tested narrow official-host normalization (`www.mit.edu` -> `mit.edu`), legitimate MIT subdomains such as `catalog.mit.edu` can be recognized without adopting broad registrable-domain trust.

## Source-freeze completion checks

- [x] 20/20 approved universities have a current application-owned institutional homepage.
- [x] Every new university owns at least one current applicant-meaningful computing program.
- [x] Exact program owner, bachelor/master level, subject label, and official HTTPS navigation are frozen.
- [x] Nested college/campus/admission-stage cases are represented explicitly rather than merged silently.
- [x] TU Delft's exact official program URL is frozen despite crawler-side 403; the link was independently resolved from current TU Delft-associated education material and TU Delft programme material.
- [x] Alberta's unresolved undergraduate placeholder was replaced rather than guessed.
- [x] Aliases are collision-checked under the project's NFKC/punctuation/case normalization; bare `UW` is excluded.
- [x] No admissions threshold, fee, deadline, scholarship value, ranking, outcome, or other decision fact was copied into catalog data.
- [x] Existing 10 university IDs and 14 program IDs/owners are preserved.
- [x] Final manifest remains within the existing 60-program contract ceiling.
