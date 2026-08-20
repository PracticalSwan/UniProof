import type { Page } from "@playwright/test";

import { expect } from "./research-browser";

export const comparePrograms = {
  mit: "Bachelor of Science in Artificial Intelligence and Decision Making (Course 6-4)",
  stanford: "Computer Science Bachelor's Program",
  georgiaTech: "Bachelor of Science in Computer Science",
  berkeley: "Computer Science",
} as const;

export async function openCompare(page: Page): Promise<void> {
  await page.goto("/compare");
  await expect(page.getByRole("heading", { level: 1, name: "Compare fit, not prestige." })).toBeVisible();
}

export async function addProgramTarget(
  page: Page,
  query: string,
  programName: string,
): Promise<void> {
  const search = page.getByLabel("Search supported universities and programs");
  await search.fill(query);
  const button = page.locator('[aria-label="Catalog search results"]').getByRole("button", { name: new RegExp(escapeRegex(programName)) }).last();
  await expect(button).toBeVisible();
  await button.click();
}

export async function selectDefaultComparisonTargets(page: Page): Promise<void> {
  await addProgramTarget(page, "MIT", comparePrograms.mit);
  await addProgramTarget(page, "Stanford", comparePrograms.stanford);
}

export async function selectThreeComparisonTargets(page: Page): Promise<void> {
  await selectDefaultComparisonTargets(page);
  await addProgramTarget(page, "Georgia Tech", comparePrograms.georgiaTech);
}

export async function selectFourComparisonTargets(page: Page): Promise<void> {
  await selectThreeComparisonTargets(page);
  await addProgramTarget(page, "Berkeley", comparePrograms.berkeley);
}

export async function submitComparison(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Compare", exact: true }).click();
}

export async function setComparisonWeight(page: Page, priorityLabel: string, value: number): Promise<void> {
  const slider = page.getByLabel(`${priorityLabel} weight`);
  await slider.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (valueSetter === undefined) throw new Error("Range input value setter is unavailable.");
    valueSetter.call(input, String(nextValue));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

export function expectComparisonRequestShape(body: unknown): asserts body is Record<string, unknown> {
  expect(body).toBeTruthy();
  expect(typeof body).toBe("object");
  const keys = Object.keys(body as Record<string, unknown>).sort();
  const allowed = ["academicYear", "categories", "intake", "programId", "universityId"];
  expect(keys.every((key) => allowed.includes(key))).toBe(true);
  for (const forbidden of [
    "weights",
    "showRankingEvidence",
    "showAnecdotalEvidence",
    "question",
    "gpa",
    "citizenship",
    "budget",
    "email",
    "document",
    "provider",
    "model",
    "applicantProfile",
  ]) {
    expect(keys).not.toContain(forbidden);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
