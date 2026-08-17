import {
  admissionsTuitionResponse,
  fixtureTarget,
  succeededAllReadyResponse,
} from "@/tests/fixtures/research-dossiers";
import {
  expect,
  expectPublicRequestShape,
  openResearch,
  selectFixtureProgram,
  submitResearch,
  test,
} from "./helpers/research-browser";

const categoryNames = [
  "Admissions",
  "Tuition",
  "Scholarships",
  "Program structure",
  "Research",
  "Outcomes",
  "Support",
] as const;

async function clearAllCategories(page: Parameters<typeof openResearch>[0]) {
  for (const name of categoryNames) {
    const checkbox = page.getByRole("checkbox", { name });
    if (await checkbox.isChecked()) await checkbox.uncheck();
  }
}

test.describe("Research form and supported target acceptance", () => {
  test("renders the real supported catalog without a prefilled illustrative dossier", async ({ page }) => {
    await openResearch(page);

    await expect(page.getByRole("button", { name: /Imperial College London.*University research/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Chulalongkorn University.*University research/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Massachusetts Institute of Technology.*University research/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Stanford University.*University research/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Research dossier" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /View evidence for/ })).toHaveCount(0);
  });

  test("searches universities and programs by aliases, subjects, case, and punctuation normalization", async ({ page }) => {
    await openResearch(page);
    const search = page.getByLabel("Search supported universities and programs");

    await search.fill("mIt");
    await expect(page.getByRole("button", { name: /Massachusetts Institute of Technology.*University research/ })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(fixtureTarget.program.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeVisible();

    await search.fill("Artificial Intelligence");
    await expect(page.getByRole("button", { name: /Artificial Intelligence BSc/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Artificial Intelligence MSc/ })).toBeVisible();

    await search.fill("gEoRgIa---tEcH");
    await expect(page.getByRole("button", { name: /Georgia Institute of Technology.*University research/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Bachelor of Science in Computer Science.*Georgia Institute of Technology/ })).toBeVisible();
  });

  test("combines country, degree, subject, and query filters with AND semantics and supports an empty result", async ({ page }) => {
    await openResearch(page);

    await page.getByLabel("Country").selectOption("TH");
    await page.getByLabel("Degree level").selectOption("master");
    await page.getByLabel("Subject").selectOption({ label: "Computer Science" });
    await page.getByLabel("Search supported universities and programs").fill("computer");

    await expect(page.getByRole("button", { name: /Master of Science Program in Computer Science and Information Technology/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Master of Science in Computer Science.*King Mongkut/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Master of Science in Computer Science.*Mahidol/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Massachusetts Institute of Technology/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Bachelor of Science/ })).toHaveCount(0);

    await page.getByLabel("Search supported universities and programs").fill("definitely unsupported target xyz");
    await expect(page.getByText(/No supported matches/)).toBeVisible();
    await expect(page.getByRole("button", { name: /definitely unsupported target xyz/i })).toHaveCount(0);
  });

  test("program selection owns its university; university-only and clear-target actions narrow or clear scope explicitly", async ({ page }) => {
    await openResearch(page);
    await selectFixtureProgram(page);

    const selected = page.getByText("Selected target").locator("..");
    await expect(selected).toContainText(fixtureTarget.university.name);
    await expect(selected).toContainText(fixtureTarget.program.name);

    await page.getByRole("button", { name: "Research university only" }).click();
    await expect(selected).toContainText("University-level research");
    await expect(selected).not.toContainText(fixtureTarget.program.name);

    await page.getByRole("button", { name: "Clear target" }).click();
    await expect(page.getByText("No target selected yet.")).toBeVisible();
  });

  test("filters never silently retarget a selected target and the selected target remains visible when excluded", async ({ page }) => {
    await openResearch(page);
    await selectFixtureProgram(page);

    await page.getByLabel("Country").selectOption("TH");
    await page.getByLabel("Degree level").selectOption("master");
    await page.getByLabel("Search supported universities and programs").fill("Mahidol");

    const selectedCard = page.getByText("Selected target").locator("..");
    await expect(selectedCard).toContainText(fixtureTarget.university.name);
    await expect(selectedCard).toContainText(fixtureTarget.program.name);
    await expect(page.getByRole("button", { name: new RegExp(fixtureTarget.program.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toHaveCount(0);
  });

  test("Reset performs no request and does not erase or relabel a previous dossier", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    research.enqueueJson(succeededAllReadyResponse);
    await submitResearch(page);
    await expect(page.getByText("Research completed")).toBeVisible();

    const before = research.requests.length;
    await page.getByLabel("Focused question (optional)").fill("A new unsent question");
    await page.getByRole("button", { name: "Reset", exact: true }).click();

    expect(research.requests).toHaveLength(before);
    await expect(page.getByText("Research completed")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: `${fixtureTarget.university.name} • ${fixtureTarget.program.name}` })).toBeVisible();
    await expect(page.getByLabel("Focused question (optional)")).toHaveValue("");
  });

  test("starts with all seven canonical categories, rejects zero categories locally, and canonicalizes reselection order", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);

    for (const name of categoryNames) {
      await expect(page.getByRole("checkbox", { name })).toBeChecked();
    }

    await clearAllCategories(page);
    await submitResearch(page);
    await expect(page.getByText("Select at least one research category.")).toBeVisible();
    expect(research.requests).toHaveLength(0);

    await page.getByRole("checkbox", { name: "Tuition" }).check();
    await page.getByRole("checkbox", { name: "Admissions" }).check();
    research.enqueueJson(admissionsTuitionResponse);
    await submitResearch(page);
    await expect(page.getByText("Research completed")).toBeVisible();

    expect(research.requests).toHaveLength(1);
    expect(research.requests[0]!.body).toMatchObject({
      categories: ["admissions", "tuition"],
    });
  });

  test("Enter in search and newline in the question textarea do not submit", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);

    const search = page.getByLabel("Search supported universities and programs");
    await search.focus();
    await search.press("Enter");
    expect(research.requests).toHaveLength(0);

    const question = page.getByLabel("Focused question (optional)");
    await question.fill("Line one");
    await question.press("Enter");
    await question.type("Line two");
    await expect(question).toHaveValue("Line one\nLine two");
    expect(research.requests).toHaveLength(0);
  });

  test("client validation rejects no target and over-limit text without dispatching", async ({ page, research }) => {
    await openResearch(page);

    await submitResearch(page);
    await expect(page.getByText("Select a supported university.")).toBeVisible();
    expect(research.requests).toHaveLength(0);

    await selectFixtureProgram(page);
    await page.getByLabel("Focused question (optional)").evaluate((element) => element.removeAttribute("maxlength"));
    await page.getByLabel("Focused question (optional)").fill("x".repeat(501));
    await submitResearch(page);
    await expect(page.getByText("Keep the question to 500 characters or fewer.")).toBeVisible();
    expect(research.requests).toHaveLength(0);

    await page.getByLabel("Focused question (optional)").fill("");
    await page.getByLabel("Intake (optional)").evaluate((element) => element.removeAttribute("maxlength"));
    await page.getByLabel("Intake (optional)").fill("i".repeat(41));
    await submitResearch(page);
    await expect(page.getByText("Keep the intake to 40 characters or fewer.")).toBeVisible();
    expect(research.requests).toHaveLength(0);
  });

  test("uses UTF-16 field limits at the astral boundary", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);

    const question = page.getByLabel("Focused question (optional)");
    const validAstral = "😀".repeat(250);
    await question.fill(validAstral);
    research.enqueueJson(succeededAllReadyResponse);
    await submitResearch(page);
    await expect(page.getByText("Research completed")).toBeVisible();
    expect((research.requests[0]!.body as Record<string, unknown>).question).toBe(validAstral);

    await question.evaluate((element) => element.removeAttribute("maxlength"));
    await question.fill("😀".repeat(251));
    await submitResearch(page);
    await expect(page.getByText("Keep the question to 500 characters or fewer.")).toBeVisible();
    expect(research.requests).toHaveLength(1);
  });

  test("valid submission dispatches one immutable public request and omits blank optional and UI-only fields", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    await page.getByLabel("Country").selectOption("US");
    await page.getByLabel("Degree level").selectOption("bachelor");
    await page.getByLabel("Subject").selectOption({ label: "Artificial Intelligence" });
    await page.getByLabel("Focused question (optional)").fill("   ");
    await page.getByLabel("Intake (optional)").fill("");
    await page.getByLabel("Academic year (optional)").fill("");

    research.enqueueJson(succeededAllReadyResponse);
    await submitResearch(page);
    await expect(page.getByText("Research completed")).toBeVisible();

    expect(research.requests).toHaveLength(1);
    const body = research.requests[0]!.body;
    expectPublicRequestShape(body);
    expect(body).toEqual({
      universityId: fixtureTarget.university.id,
      programId: fixtureTarget.program.id,
      categories: [
        "admissions",
        "tuition",
        "scholarships",
        "program-structure",
        "research",
        "outcomes",
        "support",
      ],
    });
    const requestKeys = Object.keys(body).sort();
    expect(requestKeys).not.toEqual(expect.arrayContaining([
      "name",
      "provider",
      "model",
      "key",
      "url",
      "budget",
      "search",
      "countryCode",
      "degreeLevel",
      "subjectArea",
    ]));

    const captured = structuredClone(body);
    await page.getByLabel("Focused question (optional)").fill("edited after dispatch");
    expect(research.requests[0]!.body).toEqual(captured);
  });

  test("same-tick double submission remains single-flight", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    const pending = research.enqueueDeferredJson(succeededAllReadyResponse);

    await page.getByRole("button", { name: "Research", exact: true }).evaluate((element) => {
      const button = element as HTMLButtonElement;
      button.click();
      button.click();
    });
    await pending.entered;

    expect(research.requests).toHaveLength(1);
    pending.release();
    await expect(page.getByText("Research completed")).toBeVisible();
    expect(research.requests).toHaveLength(1);
  });

  test("Enter-based valid submission dispatches exactly once", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    research.enqueueJson(succeededAllReadyResponse);

    const intake = page.getByLabel("Intake (optional)");
    await intake.fill("Fall 2027");
    await intake.press("Enter");
    await expect(page.getByText("Research completed")).toBeVisible();

    expect(research.requests).toHaveLength(1);
    expect(research.requests[0]!.body).toMatchObject({ intake: "Fall 2027" });
  });

  test("loading disables mutable controls but keeps a reachable Cancel and exposes no fake progress", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    const pending = research.enqueueDeferredJson(succeededAllReadyResponse);
    await submitResearch(page);
    await pending.entered;

    await expect(page.getByLabel("Search supported universities and programs")).toBeDisabled();
    await expect(page.getByLabel("Country")).toBeDisabled();
    await expect(page.getByLabel("Degree level")).toBeDisabled();
    await expect(page.getByLabel("Subject")).toBeDisabled();
    await expect(page.getByLabel("Focused question (optional)")).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: "Admissions" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Researching", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByText(/\b\d+%\b/)).toHaveCount(0);
    await expect(page.getByText(/provider stage|server stage/i)).toHaveCount(0);

    pending.release();
    await expect(page.getByText("Research completed")).toBeVisible();
  });
});
