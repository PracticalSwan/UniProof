import { describe, expect, it } from "vitest";

import { researchCatalog } from "@/lib/research/catalog/data";
import {
  buildResearchSubmission,
  createInitialResearchFormState,
  listResearchSubjectFilters,
  selectResearchProgram,
  selectResearchUniversity,
  toggleResearchCategory,
  type ResearchFormState,
} from "@/lib/research/mode/client-form";
import {
  RESEARCH_MODE_MAX_QUESTION_UTF16,
  researchModeCategoryOrder,
  researchModeRequestSchema,
  type ResearchModeCategory,
} from "@/lib/research/mode/public-contracts";

const mit = researchCatalog.universities.find((item) => item.id === "university-mit")!;
const mitProgram = researchCatalog.programs.find(
  (item) => item.id === "program-mit-artificial-intelligence-decision-making-bs",
)!;
const imperial = researchCatalog.universities.find((item) => item.id === "university-imperial")!;
const imperialProgram = researchCatalog.programs.find(
  (item) => item.id === "program-imperial-computing-beng",
)!;

function validState(): ResearchFormState {
  return {
    ...createInitialResearchFormState(),
    universityId: mit.id,
    programId: mitProgram.id,
  };
}

describe("initial research form state", () => {
  it("selects all seven categories once in canonical order with blank optional text", () => {
    const state = createInitialResearchFormState();

    expect(state.categories).toEqual(researchModeCategoryOrder);
    expect(new Set(state.categories).size).toBe(7);
    expect(state.question).toBe("");
    expect(state.intake).toBe("");
    expect(state.academicYear).toBe("");
    expect(state.universityId).toBeUndefined();
    expect(state.programId).toBeUndefined();
  });
});

describe("research category toggling", () => {
  it("always returns canonical order regardless of toggle order", () => {
    let categories = toggleResearchCategory(
      toggleResearchCategory(
        toggleResearchCategory(researchModeCategoryOrder, "outcomes"),
        "admissions",
      ),
      "support",
    );

    expect(categories).toEqual(["tuition", "scholarships", "program-structure", "research"]);

    categories = toggleResearchCategory(categories, "outcomes");
    expect(categories).toEqual(["tuition", "scholarships", "program-structure", "research", "outcomes"]);
  });

  it("can represent zero selected categories in form state", () => {
    let categories: ResearchModeCategory[] = [...researchModeCategoryOrder];
    for (const category of researchModeCategoryOrder) {
      categories = toggleResearchCategory(categories, category);
    }
    expect(categories).toEqual([]);
  });
});

describe("research target selection", () => {
  it("selecting a program sets its owning university", () => {
    const state = selectResearchProgram(
      { ...createInitialResearchFormState(), universityId: imperial.id },
      mitProgram.id,
      researchCatalog,
    );

    expect(state.universityId).toBe(mit.id);
    expect(state.programId).toBe(mitProgram.id);
  });

  it("selecting a university always clears program scope, including its own program", () => {
    const state = selectResearchUniversity(
      validState(),
      mit.id,
      researchCatalog,
    );

    expect(state.universityId).toBe(mit.id);
    expect(state.programId).toBeUndefined();
  });

  it("ignores unknown selection IDs rather than fuzzy retargeting", () => {
    const state = validState();

    expect(selectResearchUniversity(state, "university-does-not-exist", researchCatalog)).toBe(state);
    expect(selectResearchProgram(state, "program-does-not-exist", researchCatalog)).toBe(state);
  });

  it("keeps the selected target represented even when filters no longer match it", () => {
    const state: ResearchFormState = {
      ...validState(),
      search: "imperial",
      countryCode: "GB",
      degreeLevel: "bachelor",
      subjectArea: "Computer Science",
    };

    expect(state.universityId).toBe(mit.id);
    expect(state.programId).toBe(mitProgram.id);
  });
});

describe("subject filters", () => {
  it("derives unique deterministic subject options from catalog normalization", () => {
    const subjects = listResearchSubjectFilters(researchCatalog);

    expect(new Set(subjects).size).toBe(subjects.length);
    expect(subjects.length).toBeGreaterThan(1);
    const normalized = subjects.map((value) => value.normalize("NFKC").toLocaleLowerCase("en-US"));
    expect(normalized).toEqual([...normalized].sort((left, right) => left.localeCompare(right, "en-US")));
  });
});

describe("buildResearchSubmission", () => {
  it("builds an exact-key request from a valid program form", () => {
    const outcome = buildResearchSubmission(validState(), researchCatalog);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.submission.targetLabel).toBe(`${mit.name} • ${mitProgram.name}`);
    expect(Object.keys(outcome.submission.request)).toEqual([
      "universityId",
      "programId",
      "categories",
    ]);
    expect(outcome.submission.request).toEqual({
      universityId: mit.id,
      programId: mitProgram.id,
      categories: researchModeCategoryOrder,
    });
  });

  it("omits blank and whitespace-only optional fields instead of serializing empty strings", () => {
    const outcome = buildResearchSubmission(
      { ...validState(), question: "   ", intake: "\t\n ", academicYear: "  " },
      researchCatalog,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(Object.keys(outcome.submission.request)).toEqual([
      "universityId",
      "programId",
      "categories",
    ]);
  });

  it("trims nonblank optional fields exactly once", () => {
    const outcome = buildResearchSubmission(
      { ...validState(), question: "  AI tuition?  ", intake: " Fall 2027 ", academicYear: " 2027-28 " },
      researchCatalog,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.submission.request).toEqual({
      universityId: mit.id,
      programId: mitProgram.id,
      categories: researchModeCategoryOrder,
      question: "AI tuition?",
      intake: "Fall 2027",
      academicYear: "2027-28",
    });
  });

  it("rejects a missing or unknown university without fallback", () => {
    const missing = buildResearchSubmission(
      { ...createInitialResearchFormState() },
      researchCatalog,
    );
    expect(missing).toEqual({
      ok: false,
      fieldErrors: { universityId: expect.any(String) },
    });

    const unknown = buildResearchSubmission(
      { ...validState(), universityId: "university-unknown" },
      researchCatalog,
    );
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.fieldErrors.universityId).toEqual(expect.any(String));
  });

  it("rejects unknown or mismatched program ownership", () => {
    const unknownProgram = buildResearchSubmission(
      { ...validState(), programId: "program-unknown" },
      researchCatalog,
    );
    expect(unknownProgram).toEqual({
      ok: false,
      fieldErrors: { programId: expect.any(String) },
    });

    const mismatched = buildResearchSubmission(
      { ...validState(), programId: imperialProgram.id },
      researchCatalog,
    );
    expect(mismatched).toEqual({
      ok: false,
      fieldErrors: { programId: expect.any(String) },
    });
  });

  it("rejects zero selected categories", () => {
    const outcome = buildResearchSubmission(
      { ...validState(), categories: [] },
      researchCatalog,
    );

    expect(outcome).toEqual({
      ok: false,
      fieldErrors: { categories: expect.any(String) },
    });
  });

  it("deduplicates and canonicalizes shuffled categories", () => {
    const outcome = buildResearchSubmission(
      {
        ...validState(),
        categories: ["support", "admissions", "support", "tuition"],
      },
      researchCatalog,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.submission.request.categories).toEqual(["admissions", "tuition", "support"]);
  });

  it("enforces exact UTF-16 bounds including astral characters", () => {
    const astral = "𝕒";
    expect(astral.length).toBe(2);

    const exactQuestion = buildResearchSubmission(
      { ...validState(), question: astral.repeat(RESEARCH_MODE_MAX_QUESTION_UTF16 / 2) },
      researchCatalog,
    );
    expect(exactQuestion.ok).toBe(true);

    const overQuestion = buildResearchSubmission(
      { ...validState(), question: astral.repeat((RESEARCH_MODE_MAX_QUESTION_UTF16 / 2) + 1) },
      researchCatalog,
    );
    expect(overQuestion).toEqual({
      ok: false,
      fieldErrors: { question: expect.any(String) },
    });

    const exactIntake = buildResearchSubmission(
      { ...validState(), intake: astral.repeat(20), academicYear: astral.repeat(20) },
      researchCatalog,
    );
    expect(exactIntake.ok).toBe(true);

    const overIntake = buildResearchSubmission(
      { ...validState(), intake: astral.repeat(21) },
      researchCatalog,
    );
    expect(overIntake).toEqual({
      ok: false,
      fieldErrors: { intake: expect.any(String) },
    });

    const overYear = buildResearchSubmission(
      { ...validState(), academicYear: astral.repeat(21) },
      researchCatalog,
    );
    expect(overYear).toEqual({
      ok: false,
      fieldErrors: { academicYear: expect.any(String) },
    });
  });

  it("returns a deeply immutable validated submission", () => {
    const outcome = buildResearchSubmission(
      { ...validState(), question: "Public research context" },
      researchCatalog,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(() => {
      outcome.submission.request.question = "mutated";
    }).toThrow();
    expect(() => {
      outcome.submission.request.categories.push("tuition");
    }).toThrow();
    expect(() => {
      outcome.submission.targetLabel = "mutated";
    }).toThrow();
  });

  it("produces output that passes the strict public request schema", () => {
    const outcome = buildResearchSubmission(validState(), researchCatalog);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(researchModeRequestSchema.parse(outcome.submission.request)).toEqual(
      outcome.submission.request,
    );
  });

  it("does not treat filters or search text as the target label", () => {
    const outcome = buildResearchSubmission(
      { ...validState(), search: "totally unrelated text", countryCode: "TH" },
      researchCatalog,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.submission.targetLabel).toBe(`${mit.name} • ${mitProgram.name}`);
  });
});
