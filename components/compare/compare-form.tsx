"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  researchCatalogCountryCodes,
  researchCatalogCountryLabels,
} from "@/lib/research/catalog/countries";
import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import { categoryLabel } from "@/lib/research/mode/format";
import { researchModeCategoryOrder, type ResearchModeCategory } from "@/lib/research/mode/public-contracts";
import {
  addComparisonTarget,
  createInitialComparisonFormState,
  removeComparisonTarget,
  searchComparisonCatalog,
  setComparisonPriorityWeight,
  toggleComparisonCategory,
  type ComparisonFormField,
  type ComparisonFormState,
} from "@/lib/comparison/client-form";
import { comparisonPriorityOrder, type ComparisonPriority } from "@/lib/comparison/contracts";

const priorityLabels: Record<ComparisonPriority, string> = {
  affordability: "Affordability",
  research: "Research",
  scholarships: "Scholarships",
  outcomes: "Outcomes",
  support: "Support",
};

function targetLabel(state: ComparisonFormState["targets"][number], catalog: ResearchCatalog): string {
  const university = catalog.universities.find((item) => item.id === state.universityId);
  const program = state.programId === undefined
    ? undefined
    : catalog.programs.find((item) => item.id === state.programId);
  if (program !== undefined && university !== undefined) return `${program.name} — ${university.name}`;
  return university?.name ?? state.universityId;
}

interface CompareFormProps {
  catalog: ResearchCatalog;
  state: ComparisonFormState;
  fieldErrors: Partial<Record<ComparisonFormField, string>>;
  disabled: boolean;
  onStateChange: React.Dispatch<React.SetStateAction<ComparisonFormState>>;
  onCompare: () => void;
  onReset: () => void;
}

export function CompareForm({
  catalog,
  state,
  fieldErrors,
  disabled,
  onStateChange,
  onCompare,
  onReset,
}: CompareFormProps) {
  const results = React.useMemo(() => searchComparisonCatalog(state, catalog), [state, catalog]);
  const shownUniversityCount = Math.min(results.universities.length, 8);
  const shownProgramCount = Math.min(results.programs.length, 12);
  const totalMatches = results.universities.length + results.programs.length;
  const shownMatches = shownUniversityCount + shownProgramCount;

  const update = (patch: Partial<ComparisonFormState>) => onStateChange((current) => ({ ...current, ...patch }));

  return (
    <form
      className="mt-10 space-y-8"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onCompare();
      }}
    >
      <section className="rounded-lg border border-border bg-white p-4 sm:p-6" aria-labelledby="compare-targets-heading">
        <h2 id="compare-targets-heading" className="text-xl font-semibold">Choose two to four targets</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare universities together, or programs of the same degree level together. Search filters never replace a selected target.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem_11rem]">
          <label className="grid gap-2 text-sm font-semibold">
            Search supported universities and programs
            <input
              id="compare-target-search"
              value={state.search}
              onChange={(event) => update({ search: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              disabled={disabled}
              aria-invalid={fieldErrors.targets === undefined ? undefined : true}
              aria-describedby={fieldErrors.targets === undefined ? undefined : "compare-targets-error"}
              className="min-h-11 rounded-md border border-input bg-white px-3 py-2 font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Search MIT, Stanford, Computer Science…"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Country filter
            <select
              value={state.countryCode ?? ""}
              onChange={(event) => update({
                countryCode: event.target.value === ""
                  ? undefined
                  : event.target.value as ComparisonFormState["countryCode"],
              })}
              disabled={disabled}
              className="min-h-11 rounded-md border border-input bg-white px-3 py-2 font-normal"
            >
              <option value="">All countries</option>
              {researchCatalogCountryCodes.map((countryCode) => (
                <option key={countryCode} value={countryCode}>
                  {researchCatalogCountryLabels[countryCode]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Degree filter
            <select
              value={state.degreeLevel ?? ""}
              onChange={(event) => update({ degreeLevel: event.target.value === "" ? undefined : event.target.value as "bachelor" | "master" })}
              disabled={disabled}
              className="min-h-11 rounded-md border border-input bg-white px-3 py-2 font-normal"
            >
              <option value="">All degrees</option>
              <option value="bachelor">Bachelor</option>
              <option value="master">Master</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto rounded-md border border-border bg-panel p-2" aria-label="Catalog search results">
          <p className="px-1 py-1 text-xs text-muted-foreground">
            {totalMatches === 0
              ? "No supported matches. Change the search or filters."
              : shownMatches < totalMatches
                ? `Showing ${shownMatches} of ${totalMatches} supported matches. Refine the search to see hidden matches.`
                : `${totalMatches} supported ${totalMatches === 1 ? "match" : "matches"}.`}
          </p>
          {results.universities.slice(0, 8).map((university) => (
            <button
              key={`u-${university.id}`}
              type="button"
              disabled={disabled || state.targets.length >= 4}
              onClick={() => onStateChange((current) => addComparisonTarget(current, { universityId: university.id }, catalog))}
              className="min-h-10 rounded-md border border-border bg-white px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
            >
              <span className="font-semibold">{university.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">University target · {university.countryCode}</span>
            </button>
          ))}
          {results.programs.slice(0, 12).map((program) => {
            const university = catalog.universities.find((item) => item.id === program.universityId);
            return (
              <button
                key={`p-${program.id}`}
                type="button"
                disabled={disabled || state.targets.length >= 4}
                onClick={() => onStateChange((current) => addComparisonTarget(current, { universityId: program.universityId, programId: program.id }, catalog))}
                className="min-h-10 rounded-md border border-border bg-white px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
              >
                <span className="font-semibold">{program.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{university?.name} · {program.degreeLevel}</span>
              </button>
            );
          })}
        </div>

        <fieldset className="mt-5 rounded-md border border-border p-3" aria-describedby={fieldErrors.targets === undefined ? undefined : "compare-targets-error"}>
          <legend className="px-1 text-sm font-semibold">Selected comparison targets</legend>
          {state.targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No targets selected yet.</p>
          ) : (
            <ol className="grid gap-2">
              {state.targets.map((target, index) => (
                <li key={`${target.universityId}:${target.programId ?? ""}`} className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2">
                  <span className="min-w-0 break-words text-sm"><span className="font-semibold">Option {index + 1}:</span> {targetLabel(target, catalog)}</span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onStateChange((current) => removeComparisonTarget(current, target))}
                    className="min-h-8 shrink-0 rounded-md border border-border bg-white px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label={`Remove ${targetLabel(target, catalog)}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          )}
          {fieldErrors.targets === undefined ? null : <p id="compare-targets-error" role="alert" className="mt-2 text-sm font-semibold text-destructive">{fieldErrors.targets}</p>}
        </fieldset>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <fieldset className="rounded-lg border border-border bg-white p-4 sm:p-6" aria-describedby={fieldErrors.categories === undefined ? undefined : "compare-categories-error"}>
          <legend className="sr-only">Research categories</legend>
          <h2 className="text-lg font-semibold">Research categories</h2>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">These seven categories control what each existing Research request asks for.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {researchModeCategoryOrder.map((category) => (
              <label key={category} className="flex min-h-8 items-center gap-2 text-sm">
                <input
                  id={`compare-category-${category}`}
                  type="checkbox"
                  checked={state.categories.includes(category)}
                  onChange={() => onStateChange((current) => ({
                    ...current,
                    categories: toggleComparisonCategory(current.categories, category as ResearchModeCategory),
                  }))}
                  disabled={disabled}
                  aria-invalid={fieldErrors.categories === undefined ? undefined : true}
                />
                {categoryLabel(category)}
              </label>
            ))}
          </div>
          {fieldErrors.categories === undefined ? null : <p id="compare-categories-error" role="alert" className="mt-3 text-sm font-semibold text-destructive">{fieldErrors.categories}</p>}
        </fieldset>

        <fieldset className="rounded-lg border border-border bg-white p-4 sm:p-6" aria-describedby={fieldErrors.weights === undefined ? undefined : "compare-weights-error"}>
          <legend className="sr-only">Comparison priorities</legend>
          <h2 className="text-lg font-semibold">Comparison priorities</h2>
          <p className="mb-5 mt-2 text-sm text-muted-foreground">
            Set relative importance from 0 to 100. UniProof normalizes positive values when scoring; at least one priority must be above 0.
          </p>
          <div className="grid gap-5">
            {comparisonPriorityOrder.map((priority) => {
              const id = `compare-weight-${priority}`;
              const errorId = `${id}-error`;
              const fieldError = fieldErrors[`weight-${priority}`];
              return (
                <div key={priority} className="grid gap-2">
                  <label htmlFor={id} className="text-sm font-semibold">{priorityLabels[priority]} weight</label>
                  <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3">
                    <input
                      id={id}
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={state.weights[priority]}
                      onChange={(event) => {
                        const value = event.target.value;
                        onStateChange((current) => setComparisonPriorityWeight(current, priority, value));
                      }}
                      disabled={disabled}
                      aria-invalid={fieldError === undefined ? undefined : true}
                      aria-describedby={fieldError === undefined ? (fieldErrors.weights === undefined ? undefined : "compare-weights-error") : errorId}
                      className="h-8 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <span
                      data-testid={`${id}-value`}
                      aria-hidden="true"
                      className="min-w-0 rounded-md border border-border bg-panel px-2 py-1 text-right text-sm font-semibold tabular-nums"
                    >
                      {state.weights[priority]}
                    </span>
                  </div>
                  {fieldError === undefined ? null : <span id={errorId} className="text-xs font-normal text-destructive">{fieldError}</span>}
                </div>
              );
            })}
          </div>
          {fieldErrors.weights === undefined ? null : <p id="compare-weights-error" role="alert" className="mt-4 text-sm font-semibold text-destructive">{fieldErrors.weights}</p>}
        </fieldset>
      </section>

      <section className="rounded-lg border border-border bg-white p-4 sm:p-6" aria-labelledby="compare-context-heading">
        <h2 id="compare-context-heading" className="text-lg font-semibold">Context and evidence display</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            Intake (public context only, optional)
            <input
              id="compare-intake"
              value={state.intake}
              onChange={(event) => update({ intake: event.target.value })}
              disabled={disabled}
              maxLength={40}
              aria-invalid={fieldErrors.intake === undefined ? undefined : true}
              aria-describedby={fieldErrors.intake === undefined ? undefined : "compare-intake-error"}
              className="min-h-10 rounded-md border border-input bg-white px-3 py-2 font-normal"
            />
            {fieldErrors.intake === undefined ? null : <span id="compare-intake-error" className="text-xs text-destructive">{fieldErrors.intake}</span>}
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Academic year (public context only, optional)
            <input
              id="compare-academic-year"
              value={state.academicYear}
              onChange={(event) => update({ academicYear: event.target.value })}
              disabled={disabled}
              maxLength={40}
              aria-invalid={fieldErrors.academicYear === undefined ? undefined : true}
              aria-describedby={fieldErrors.academicYear === undefined ? undefined : "compare-academic-year-error"}
              className="min-h-10 rounded-md border border-input bg-white px-3 py-2 font-normal"
            />
            {fieldErrors.academicYear === undefined ? null : <span id="compare-academic-year-error" className="text-xs text-destructive">{fieldErrors.academicYear}</span>}
          </label>
        </div>
        <div className="mt-5 grid gap-3">
          <label className="flex min-h-8 items-center gap-2 text-sm">
            <input type="checkbox" checked={state.showRankingEvidence} onChange={(event) => update({ showRankingEvidence: event.target.checked })} disabled={disabled} />
            Show ranking-derived contextual evidence (display only; never scored)
          </label>
          <label className="flex min-h-8 items-center gap-2 text-sm">
            <input type="checkbox" checked={state.showAnecdotalEvidence} onChange={(event) => update({ showAnecdotalEvidence: event.target.checked })} disabled={disabled} />
            Show student/community opinion (display only; never scored)
          </label>
        </div>
        <p className="mt-4 rounded-md bg-secondary p-3 text-sm leading-6 text-muted-foreground">
          Compare does not collect applicant profiles, GPA, citizenship, budget, email, documents, or a free-form question. Do not enter applicant/private information here.
        </p>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-border pt-5">
        <Button type="submit" disabled={disabled} className="min-h-11 px-6">Compare</Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="min-h-11 px-6"
          onClick={() => {
            onStateChange(createInitialComparisonFormState());
            onReset();
          }}
        >
          Reset form
        </Button>
      </div>
    </form>
  );
}
