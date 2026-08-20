import { expect, type Page } from "@playwright/test";

import type { ResearchDossier } from "@/lib/research/mode/public-contracts";
import { guideCatalogTarget } from "@/tests/helpers/catalog-targets";

export const guideFixtureTarget = guideCatalogTarget;

export async function openGuide(page: Page): Promise<void> {
  await page.goto("/guide");
  await expect(page.getByRole("heading", { level: 1, name: "Turn requirements into a plan you can act on." })).toBeVisible();
}

export async function selectGuideProgram(page: Page): Promise<void> {
  await page.getByLabel("Supported program").selectOption(guideFixtureTarget.program.id);
}

export async function fillGuideProfile(page: Page, options: {
  citizenship?: string;
  currentCountry?: string;
  qualificationTitle?: string;
  qualificationSubject?: string;
  gpaValue?: string;
  gpaScale?: string;
  englishKind?: "not-provided" | "ielts" | "toefl-ibt" | "pte-academic" | "other";
  englishOverall?: string;
  englishListening?: string;
  englishReading?: string;
  englishWriting?: string;
  englishSpeaking?: string;
  otherEnglishName?: string;
  otherEnglishScore?: string;
  budgetAmount?: string;
  budgetCurrency?: string;
  budgetScope?: "annual" | "total";
  scholarshipNeed?: boolean;
  intake?: string;
  academicYear?: string;
}): Promise<void> {
  const fields: Array<[string, string]> = [
    ["Citizenship", options.citizenship ?? "Testland"],
    ["Current country", options.currentCountry ?? "Testland"],
    ["Title", options.qualificationTitle ?? "BSc Test Subject"],
    ["Subject", options.qualificationSubject ?? "Computer Science"],
  ];
  for (const [label, value] of fields) {
    await page.getByLabel(label, { exact: false }).fill(value);
  }
  if (options.gpaValue !== undefined) {
    await page.getByLabel("GPA value (optional)").fill(options.gpaValue);
  }
  if (options.gpaScale !== undefined) {
    await page.getByLabel("GPA scale (optional)").fill(options.gpaScale);
  }
  if (options.intake !== undefined) await page.getByLabel("Intake", { exact: false }).fill(options.intake);
  if (options.academicYear !== undefined) await page.getByLabel("Academic year", { exact: false }).fill(options.academicYear);
  if (options.englishKind !== undefined) {
    await page.getByLabel("Test type").selectOption(options.englishKind);
    if (options.englishKind === "ielts" || options.englishKind === "toefl-ibt" || options.englishKind === "pte-academic") {
      if (options.englishOverall !== undefined) await page.getByLabel("Overall score").fill(options.englishOverall);
      if (options.englishKind === "ielts" || options.englishKind === "toefl-ibt") {
        const components: Array<[string, string | undefined]> = [
          ["Listening", options.englishListening],
          ["Reading", options.englishReading],
          ["Writing", options.englishWriting],
          ["Speaking", options.englishSpeaking],
        ];
        for (const [label, value] of components) if (value !== undefined) await page.getByLabel(label).fill(value);
      }
    } else if (options.englishKind === "other") {
      if (options.otherEnglishName !== undefined) await page.getByLabel("Test name").fill(options.otherEnglishName);
      if (options.otherEnglishScore !== undefined) await page.getByLabel("Score", { exact: true }).fill(options.otherEnglishScore);
    }
  }
  if (options.budgetAmount !== undefined) await page.getByLabel("Amount (optional)").fill(options.budgetAmount);
  if (options.budgetCurrency !== undefined) await page.getByLabel("Currency").fill(options.budgetCurrency);
  if (options.budgetScope !== undefined) await page.getByLabel("Scope").selectOption(options.budgetScope);
  if (options.scholarshipNeed !== undefined) {
    const checkbox = page.getByRole("checkbox", { name: /scholarship or funding consideration/i });
    if (options.scholarshipNeed) await checkbox.check();
    else await checkbox.uncheck();
  }
}

export async function submitGuide(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Assess", exact: true }).click();
}

export function makeGuideDossierResponse(dossier: ResearchDossier) {
  return { ok: true as const, dossier };
}
