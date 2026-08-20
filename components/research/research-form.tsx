"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  researchCatalogCountryCodes,
  researchCatalogCountryLabels,
} from "@/lib/research/catalog/countries";
import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import type {
  ResearchFormField,
  ResearchFormState,
} from "@/lib/research/mode/client-form";
import {
  listResearchSubjectFilters,
  searchResearchFormCatalog,
  toggleResearchCategory,
} from "@/lib/research/mode/client-form";
import { categoryLabel } from "@/lib/research/mode/format";
import { researchModeCategoryOrder } from "@/lib/research/mode/public-contracts";
import { cn } from "@/lib/utils";

interface ResearchFormProps {
  formState: ResearchFormState;
  catalog: ResearchCatalog;
  disabled: boolean;
  fieldErrors: Partial<Record<ResearchFormField, string>>;
  serverErrorCode: string | null;
  onPatch: (patch: Partial<ResearchFormState>) => void;
  onSelectUniversity: (universityId: string) => void;
  onSelectProgram: (programId: string) => void;
  onClearTarget: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
}

const FREE_TEXT_PRIVACY_HELP =
  "Use these fields only for public university/program research context. Do not include personal documents, IDs, account details, academic records, or other sensitive information.";

export function ResearchForm({
  formState,
  catalog,
  disabled,
  fieldErrors,
  serverErrorCode,
  onPatch,
  onSelectUniversity,
  onSelectProgram,
  onClearTarget,
  onSubmit,
  onReset,
}: ResearchFormProps) {
  const subjects = React.useMemo(
    () => listResearchSubjectFilters(catalog),
    [catalog],
  );
  const results = React.useMemo(
    () => searchResearchFormCatalog(formState, catalog),
    [formState, catalog],
  );

  const selectedUniversity = formState.universityId === undefined
    ? undefined
    : catalog.universities.find((university) => university.id === formState.universityId);
  const selectedProgram = formState.programId === undefined
    ? undefined
    : catalog.programs.find((program) => program.id === formState.programId);
  const sensitiveInputError = serverErrorCode === "sensitive-input";
  const programErrorVisible = fieldErrors.programId !== undefined;
  const searchErrorIds = [
    fieldErrors.universityId === undefined ? undefined : "research-university-error",
    programErrorVisible ? "research-program-error" : undefined,
  ].filter((value): value is string => value !== undefined);
  const searchDescribedBy = ["research-search-help", ...searchErrorIds].join(" ");
  const freeTextDescribedBy = (field: "question" | "intake" | "academicYear") => [
    "research-free-text-help",
    fieldErrors[field] === undefined ? undefined : `research-${field}-error`,
  ].filter((value): value is string => value !== undefined).join(" ");
  const sensitiveFieldInvalid = (value: string) => sensitiveInputError && value.trim() !== "";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-lg border border-border bg-secondary p-4 sm:p-5"
      aria-labelledby="research-target-heading"
    >
      <h2 id="research-target-heading" className="text-lg font-semibold">
        Research target
      </h2>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="min-w-0">
          <label htmlFor="research-search" className="text-sm font-medium">
            Search supported universities and programs
          </label>
          <Input
            id="research-search"
            className="mt-2 h-10 bg-white px-3"
            value={formState.search}
            onChange={(event) => onPatch({ search: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            disabled={disabled}
            placeholder="e.g. Artificial Intelligence, MIT, Computing"
            aria-invalid={searchErrorIds.length > 0}
            aria-describedby={searchDescribedBy}
            autoComplete="off"
          />
          <p id="research-search-help" className="mt-1 text-xs text-muted-foreground">
            Search matches supported targets only. Press Enter to keep editing; use the Research
            button to start research.
          </p>
        </div>

        <div className="min-w-0">
          <label htmlFor="research-country" className="text-sm font-medium">
            Country
          </label>
          <select
            id="research-country"
            className="mt-2 h-10 w-full min-w-0 rounded-lg border border-input bg-white px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            value={formState.countryCode ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onPatch({ countryCode: value === "" ? undefined : value as ResearchFormState["countryCode"] });
            }}
            disabled={disabled}
          >
            <option value="">All countries</option>
            {researchCatalogCountryCodes.map((countryCode) => (
              <option key={countryCode} value={countryCode}>
                {researchCatalogCountryLabels[countryCode]}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="research-degree" className="text-sm font-medium">
            Degree level
          </label>
          <select
            id="research-degree"
            className="mt-2 h-10 w-full min-w-0 rounded-lg border border-input bg-white px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            value={formState.degreeLevel ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onPatch({ degreeLevel: value === "" ? undefined : value as ResearchFormState["degreeLevel"] });
            }}
            disabled={disabled}
          >
            <option value="">All levels</option>
            <option value="bachelor">Bachelor</option>
            <option value="master">Master</option>
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="research-subject" className="text-sm font-medium">
            Subject
          </label>
          <select
            id="research-subject"
            className="mt-2 h-10 w-full min-w-0 rounded-lg border border-input bg-white px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            value={formState.subjectArea ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onPatch({ subjectArea: value === "" ? undefined : value });
            }}
            disabled={disabled}
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>
      </div>

      {results.universities.length === 0 && results.programs.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          No supported matches. Adjust the search or filters; unsupported targets cannot be
          researched in this MVP.
        </p>
      ) : (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Supported matches
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2" aria-label="Supported search matches">
            {results.universities.map((university) => (
              <li key={university.id} className="min-w-0">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectUniversity(university.id)}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-start gap-0.5 rounded-md border border-border bg-white px-3 py-2 text-left outline-none",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "disabled:pointer-events-none disabled:opacity-50",
                    formState.universityId === university.id && formState.programId === undefined &&
                      "border-primary bg-accent",
                  )}
                >
                  <span className="min-w-0 break-words text-sm font-semibold">{university.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {researchCatalogCountryLabels[university.countryCode]} · University research
                  </span>
                </button>
              </li>
            ))}
            {results.programs.map((program) => {
              const owner = catalog.universities.find(
                (university) => university.id === program.universityId,
              );
              if (owner === undefined) return null;
              return (
                <li key={program.id} className="min-w-0">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectProgram(program.id)}
                    className={cn(
                      "flex min-h-11 w-full flex-col items-start gap-0.5 rounded-md border border-border bg-white px-3 py-2 text-left outline-none",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                      "disabled:pointer-events-none disabled:opacity-50",
                      formState.programId === program.id && "border-primary bg-accent",
                    )}
                  >
                    <span className="min-w-0 break-words text-sm font-semibold">{program.name}</span>
                    <span className="min-w-0 break-words text-xs text-muted-foreground">
                      {owner.name} · {researchCatalogCountryLabels[owner.countryCode]} ·{" "}
                      {program.degreeLevel === "bachelor" ? "Bachelor" : "Master"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-5 rounded-md border border-border bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Selected target
        </p>
        {selectedUniversity === undefined ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground" id="research-university-error">
              {fieldErrors.universityId ?? "No target selected yet."}
            </p>
            {fieldErrors.programId !== undefined ? (
              <p id="research-program-error" className="mt-1 text-sm text-destructive">
                {fieldErrors.programId}
              </p>
            ) : null}
          </>
        ) : (
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="break-words text-[15px] font-semibold">{selectedUniversity.name}</p>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {selectedProgram === undefined
                  ? "University-level research"
                  : `${selectedProgram.name} · ${
                      selectedProgram.degreeLevel === "bachelor" ? "Bachelor" : "Master"
                    } program research`}
              </p>
              {fieldErrors.programId !== undefined ? (
                <p id="research-program-error" className="mt-1 text-sm text-destructive">
                  {fieldErrors.programId}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedProgram !== undefined ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => onSelectUniversity(selectedUniversity.id)}
                >
                  Research university only
                </Button>
              ) : null}
              <Button type="button" variant="outline" disabled={disabled} onClick={onClearTarget}>
                Clear target
              </Button>
            </div>
          </div>
        )}
      </div>

      <fieldset disabled={disabled} className="mt-6 min-w-0 border-0 p-0">
        <legend className="text-lg font-semibold">Research options</legend>

        <div className="mt-3">
          <p className="text-sm font-medium">Categories</p>
          {fieldErrors.categories !== undefined ? (
            <p id="research-categories-error" className="mt-1 text-sm text-destructive">
              {fieldErrors.categories}
            </p>
          ) : null}
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Research categories">
            {researchModeCategoryOrder.map((category) => {
              const id = `research-category-${category}`;
              const checked = formState.categories.includes(category);
              return (
                <li key={category} className="min-w-0">
                  <label
                    htmlFor={id}
                    className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-white px-3 py-2 text-sm"
                  >
                    <input
                      id={id}
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={checked}
                      onChange={() =>
                        onPatch({ categories: toggleResearchCategory(formState.categories, category) })
                      }
                      aria-invalid={fieldErrors.categories !== undefined}
                      aria-describedby={fieldErrors.categories !== undefined ? "research-categories-error" : undefined}
                    />
                    <span className="min-w-0 break-words">{categoryLabel(category)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <label htmlFor="research-question" className="text-sm font-medium">
              Focused question (optional)
            </label>
            <textarea
              id="research-question"
              className="mt-2 min-h-20 w-full min-w-0 rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
              value={formState.question}
              maxLength={500}
              onChange={(event) => onPatch({ question: event.target.value })}
              aria-invalid={sensitiveFieldInvalid(formState.question) || fieldErrors.question !== undefined}
              aria-describedby={freeTextDescribedBy("question")}
              placeholder="e.g. What are the published AI degree requirements?"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="research-intake" className="text-sm font-medium">
              Intake (optional)
            </label>
            <Input
              id="research-intake"
              className="mt-2 bg-white"
              value={formState.intake}
              maxLength={40}
              onChange={(event) => onPatch({ intake: event.target.value })}
              aria-invalid={sensitiveFieldInvalid(formState.intake) || fieldErrors.intake !== undefined}
              aria-describedby={freeTextDescribedBy("intake")}
              placeholder="Fall 2027"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="research-year" className="text-sm font-medium">
              Academic year (optional)
            </label>
            <Input
              id="research-year"
              className="mt-2 bg-white"
              value={formState.academicYear}
              maxLength={40}
              onChange={(event) => onPatch({ academicYear: event.target.value })}
              aria-invalid={sensitiveFieldInvalid(formState.academicYear) || fieldErrors.academicYear !== undefined}
              aria-describedby={freeTextDescribedBy("academicYear")}
              placeholder="2027-28"
            />
          </div>
        </div>
        <p
          id="research-free-text-help"
          className={cn(
            "mt-2 break-words text-xs",
            sensitiveInputError ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {sensitiveInputError
            ? `${FREE_TEXT_PRIVACY_HELP} Please edit the populated fields and remove sensitive information, then start a new request.`
            : FREE_TEXT_PRIVACY_HELP}
        </p>
        <ul className="mt-2 list-none space-y-1">
          {(["question", "intake", "academicYear"] as const).map((field) => {
            const message = fieldErrors[field];
            if (message === undefined) return null;
            return (
              <li id={`research-${field}-error`} key={field} className="text-sm text-destructive">
                {message}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="submit" size="lg" className="h-11 px-6" disabled={disabled}>
          {disabled ? "Researching" : "Research"}
        </Button>
        <Button type="button" size="lg" variant="outline" className="h-11" disabled={disabled} onClick={onReset}>
          Reset
        </Button>
      </div>
    </form>
  );
}
