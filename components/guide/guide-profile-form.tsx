"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import type { GuideDraft, GuideFieldErrors } from "@/lib/guide/client-form";
import {
  guideQualificationLevelOrder,
  type GuideQualificationLevel,
} from "@/lib/guide/contracts";
import { searchResearchCatalog } from "@/lib/research/catalog/search";

interface GuideProfileFormProps {
  draft: GuideDraft;
  errors: GuideFieldErrors;
  disabled: boolean;
  catalog: ResearchCatalog;
  onDraftChange: (updates: Partial<GuideDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onReset: () => void;
  onRefresh: () => void;
  hasResult: boolean;
  canRefresh: boolean;
}

const inputClass = "h-[42px] w-full min-w-0 max-w-full rounded-md border border-input bg-white px-3 text-sm";

const qualificationLevelLabels: Readonly<Record<GuideQualificationLevel, string>> = {
  secondary: "Secondary",
  diploma: "Diploma",
  bachelor: "Bachelor",
  master: "Master",
  doctorate: "Doctorate",
  other: "Other",
};

export function GuideProfileForm({
  draft,
  errors,
  disabled,
  catalog,
  onDraftChange,
  onSubmit,
  onCancel,
  onReset,
  onRefresh,
  hasResult,
  canRefresh,
}: GuideProfileFormProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchResults = React.useMemo(
    () => searchResearchCatalog(catalog, { query: searchQuery, degreeLevel: undefined }),
    [catalog, searchQuery],
  );

  const selectedProgram = catalog.programs.find((p) => p.id === draft.programId);
  const visiblePrograms = React.useMemo(() => {
    if (selectedProgram === undefined || searchResults.programs.some((program) => program.id === selectedProgram.id)) {
      return searchResults.programs;
    }
    return [selectedProgram, ...searchResults.programs];
  }, [searchResults.programs, selectedProgram]);
  const selectedUniversity = catalog.universities.find((u) => u.id === draft.universityId);

  const fieldError = (field: string): React.ReactNode =>
    errors[field] !== undefined ? (
      <p id={`guide-error-${field}`} className="text-xs font-medium text-destructive">
        {errors[field]}
      </p>
    ) : null;

  const describedBy = (field: string, helpId?: string): string | undefined => {
    const parts = [
      ...(helpId !== undefined ? [helpId] : []),
      ...(errors[field] !== undefined ? [`guide-error-${field}`] : []),
    ];
    return parts.length > 0 ? parts.join(" ") : undefined;
  };

  const isInvalid = (field: string): boolean | undefined =>
    errors[field] !== undefined ? true : undefined;

  return (
    <form
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="min-w-0 space-y-6"
      aria-label="Applicant profile"
    >
      <fieldset disabled={disabled} className="min-w-0 space-y-6">
        <legend className="text-lg font-semibold">Target program</legend>
        <div className="space-y-3">
          <div>
            <label htmlFor="guide-program-search" className="text-sm font-medium">
              Search programs
            </label>
            <Input
              id="guide-program-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Search by university or program name"
              className={inputClass}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="guide-program-select" className="text-sm font-medium">
              Supported program
            </label>
            <select
              id="guide-program-select"
              value={draft.programId}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "") {
                  onDraftChange({ programId: "", universityId: "" });
                  return;
                }
                const program = catalog.programs.find((p) => p.id === value);
                if (program !== undefined) {
                  onDraftChange({ programId: program.id, universityId: program.universityId });
                }
              }}
              className={inputClass}
              autoComplete="off"
              aria-invalid={isInvalid("target")}
              aria-describedby={describedBy("target")}
            >
              <option value="">Select a supported program</option>
              {visiblePrograms.map((program) => {
                const university = catalog.universities.find((u) => u.id === program.universityId);
                if (university === undefined) return null;
                return (
                  <option key={program.id} value={program.id}>
                    {program.name} - {university.name}
                  </option>
                );
              })}
            </select>
            {fieldError("target")}
            {selectedProgram !== undefined && selectedUniversity !== undefined ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedProgram.name} - {selectedUniversity.name} ({selectedProgram.degreeLevel})
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <label htmlFor="guide-intake" className="grid text-sm font-medium sm:min-h-12 sm:content-end">
              <span>Intake</span>
              <span className="text-xs font-normal text-muted-foreground">Optional, sent to Research</span>
            </label>
            <Input
              id="guide-intake"
              value={draft.intake}
              onChange={(event) => onDraftChange({ intake: event.target.value })}
              placeholder="e.g. September 2027"
              className={inputClass}
              autoComplete="off"
              aria-invalid={isInvalid("intake")}
              aria-describedby={describedBy("intake")}
            />
            {fieldError("intake")}
          </div>
          <div className="grid content-start gap-1.5">
            <label htmlFor="guide-year" className="grid text-sm font-medium sm:min-h-12 sm:content-end">
              <span>Academic year</span>
              <span className="text-xs font-normal text-muted-foreground">Optional, sent to Research</span>
            </label>
            <Input
              id="guide-year"
              value={draft.academicYear}
              onChange={(event) => onDraftChange({ academicYear: event.target.value })}
              placeholder="e.g. 2027-28"
              className={inputClass}
              autoComplete="off"
              aria-invalid={isInvalid("academicYear")}
              aria-describedby={describedBy("academicYear")}
            />
            {fieldError("academicYear")}
          </div>
        </div>
      </fieldset>

      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <legend className="text-lg font-semibold">Citizenship and current country</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="guide-citizenship" className="text-sm font-medium">Citizenship</label>
            <Input
              id="guide-citizenship"
              value={draft.citizenship}
              onChange={(event) => onDraftChange({ citizenship: event.target.value })}
              className={inputClass}
              autoComplete="off"
              aria-invalid={isInvalid("citizenship")}
              aria-describedby={describedBy("citizenship", "guide-privacy-help")}
            />
            {fieldError("citizenship")}
          </div>
          <div>
            <label htmlFor="guide-current-country" className="text-sm font-medium">Current country</label>
            <Input
              id="guide-current-country"
              value={draft.currentCountry}
              onChange={(event) => onDraftChange({ currentCountry: event.target.value })}
              className={inputClass}
              autoComplete="off"
              aria-invalid={isInvalid("currentCountry")}
              aria-describedby={describedBy("currentCountry", "guide-privacy-help")}
            />
            {fieldError("currentCountry")}
          </div>
        </div>
      </fieldset>

      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <legend className="text-lg font-semibold">Qualification</legend>
        <div>
          <label htmlFor="guide-qual-level" className="text-sm font-medium">Level</label>
          <select
            id="guide-qual-level"
            value={draft.qualificationLevel}
            onChange={(event) => onDraftChange({ qualificationLevel: event.target.value })}
            className={inputClass}
            autoComplete="off"
          >
            {guideQualificationLevelOrder.map((level) => (
              <option key={level} value={level}>{qualificationLevelLabels[level]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="guide-qual-title" className="text-sm font-medium">Title</label>
          <Input
            id="guide-qual-title"
            value={draft.qualificationTitle}
            onChange={(event) => onDraftChange({ qualificationTitle: event.target.value })}
            placeholder="e.g. BSc Computer Science"
            className={inputClass}
            autoComplete="off"
            aria-invalid={isInvalid("qualificationTitle")}
            aria-describedby={describedBy("qualificationTitle")}
          />
          {fieldError("qualificationTitle")}
        </div>
        <div>
          <label htmlFor="guide-qual-subject" className="text-sm font-medium">Subject</label>
          <Input
            id="guide-qual-subject"
            value={draft.qualificationSubject}
            onChange={(event) => onDraftChange({ qualificationSubject: event.target.value })}
            placeholder="e.g. Computer Science"
            className={inputClass}
            autoComplete="off"
            aria-invalid={isInvalid("qualificationSubject")}
            aria-describedby={describedBy("qualificationSubject")}
          />
          {fieldError("qualificationSubject")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="guide-gpa-value" className="text-sm font-medium">GPA value (optional)</label>
            <Input
              id="guide-gpa-value"
              type="text"
              inputMode="decimal"
              value={draft.gpaValue}
              onChange={(event) => onDraftChange({ gpaValue: event.target.value })}
              placeholder="e.g. 3.40"
              className={inputClass}
              autoComplete="off"
              aria-invalid={isInvalid("gpaValue")}
              aria-describedby={describedBy("gpaValue")}
            />
            {fieldError("gpaValue")}
          </div>
          <div>
            <label htmlFor="guide-gpa-scale" className="text-sm font-medium">GPA scale (optional)</label>
            <Input
              id="guide-gpa-scale"
              type="text"
              inputMode="decimal"
              value={draft.gpaScale}
              onChange={(event) => onDraftChange({ gpaScale: event.target.value })}
              placeholder="e.g. 4.00"
              className={inputClass}
              autoComplete="off"
              aria-invalid={isInvalid("gpaScale")}
              aria-describedby={describedBy("gpaScale")}
            />
            {fieldError("gpaScale")}
          </div>
        </div>
      </fieldset>

      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <legend className="text-lg font-semibold">English test</legend>
        <div>
          <label htmlFor="guide-english-kind" className="text-sm font-medium">Test type</label>
          <select
            id="guide-english-kind"
            value={draft.englishKind}
            onChange={(event) => onDraftChange({ englishKind: event.target.value })}
            className={inputClass}
            autoComplete="off"
          >
            <option value="not-provided">Not provided</option>
            <option value="ielts">IELTS</option>
            <option value="toefl-ibt">TOEFL iBT</option>
            <option value="pte-academic">PTE Academic</option>
            <option value="other">Other</option>
          </select>
        </div>
        {draft.englishKind === "ielts" || draft.englishKind === "toefl-ibt" || draft.englishKind === "pte-academic" ? (
          <div>
            <label htmlFor="guide-english-overall" className="text-sm font-medium">Overall score</label>
            <Input
              id="guide-english-overall"
              type="text"
              inputMode="decimal"
              value={draft.englishOverall}
              onChange={(event) => onDraftChange({ englishOverall: event.target.value })}
              className={inputClass}
              autoComplete="off"
              aria-invalid={isInvalid("englishOverall")}
              aria-describedby={describedBy("englishOverall")}
            />
            {fieldError("englishOverall")}
          </div>
        ) : null}
        {draft.englishKind === "ielts" || draft.englishKind === "toefl-ibt" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(["listening", "reading", "writing", "speaking"] as const).map((component) => (
              <div key={component}>
                <label htmlFor={`guide-english-${component}`} className="text-sm font-medium capitalize">
                  {component} (optional)
                </label>
                <Input
                  id={`guide-english-${component}`}
                  type="text"
                  inputMode="decimal"
                  value={draft[`english${component.charAt(0).toUpperCase()}${component.slice(1)}` as keyof GuideDraft] as string}
                  onChange={(event) => onDraftChange({ [`english${component.charAt(0).toUpperCase()}${component.slice(1)}`]: event.target.value } as Partial<GuideDraft>)}
                  className={inputClass}
                  autoComplete="off"
                  aria-invalid={isInvalid("englishComponents")}
                  aria-describedby={describedBy("englishComponents")}
                />
              </div>
            ))}
            {fieldError("englishComponents")}
          </div>
        ) : null}
        {draft.englishKind === "other" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="guide-other-english-name" className="text-sm font-medium">Test name</label>
              <Input
                id="guide-other-english-name"
                value={draft.otherEnglishName}
                onChange={(event) => onDraftChange({ otherEnglishName: event.target.value })}
                className={inputClass}
                autoComplete="off"
                aria-invalid={isInvalid("otherEnglishName")}
                aria-describedby={describedBy("otherEnglishName")}
              />
              {fieldError("otherEnglishName")}
            </div>
            <div>
              <label htmlFor="guide-other-english-score" className="text-sm font-medium">Score</label>
              <Input
                id="guide-other-english-score"
                value={draft.otherEnglishScore}
                onChange={(event) => onDraftChange({ otherEnglishScore: event.target.value })}
                className={inputClass}
                autoComplete="off"
                aria-invalid={isInvalid("otherEnglishScore")}
                aria-describedby={describedBy("otherEnglishScore")}
              />
              {fieldError("otherEnglishScore")}
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <legend className="text-lg font-semibold">Budget and scholarships</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid content-start gap-1.5">
            <label htmlFor="guide-budget-amount" className="text-sm font-medium sm:flex sm:min-h-10 sm:items-end">Amount (optional)</label>
            <Input
              id="guide-budget-amount"
              type="text"
              inputMode="decimal"
              value={draft.budgetAmount}
              onChange={(event) => onDraftChange({ budgetAmount: event.target.value })}
              className={inputClass}
              autoComplete="off"
              aria-invalid={isInvalid("budgetAmount")}
              aria-describedby={describedBy("budgetAmount")}
            />
            {fieldError("budgetAmount")}
          </div>
          <div className="grid content-start gap-1.5">
            <label htmlFor="guide-budget-currency" className="text-sm font-medium sm:flex sm:min-h-10 sm:items-end">Currency</label>
            <Input
              id="guide-budget-currency"
              value={draft.budgetCurrency}
              onChange={(event) => onDraftChange({ budgetCurrency: event.target.value })}
              placeholder="e.g. USD"
              maxLength={3}
              className={inputClass}
              autoComplete="off"
              aria-invalid={isInvalid("budgetCurrency")}
              aria-describedby={describedBy("budgetCurrency")}
            />
            {fieldError("budgetCurrency")}
          </div>
          <div className="grid content-start gap-1.5">
            <label htmlFor="guide-budget-scope" className="text-sm font-medium sm:flex sm:min-h-10 sm:items-end">Scope</label>
            <select
              id="guide-budget-scope"
              value={draft.budgetScope}
              onChange={(event) => onDraftChange({ budgetScope: event.target.value })}
              className={inputClass}
              autoComplete="off"
            >
              <option value="annual">Annual</option>
              <option value="total">Total</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="guide-scholarship-need"
            type="checkbox"
            checked={draft.scholarshipNeed}
            onChange={(event) => onDraftChange({ scholarshipNeed: event.target.checked })}
            className="h-4 w-4"
            aria-describedby={describedBy("scholarshipNeed")}
          />
          <label htmlFor="guide-scholarship-need" className="text-sm font-medium">
            I need scholarship or funding consideration
          </label>
        </div>
      </fieldset>

      <p id="guide-privacy-help" className="text-xs text-muted-foreground">
        Your profile stays in this tab. Only the selected program and optional intake/year are sent to UniProof Research.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={disabled} className="h-[42px] px-5">
          {disabled ? "Assessing..." : "Assess"}
        </Button>
        {disabled ? (
          <Button type="button" variant="outline" onClick={onCancel} className="h-[42px]">
            Cancel
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onReset} disabled={disabled} className="h-[42px]">
          Reset
        </Button>
        {hasResult && canRefresh && !disabled ? (
          <Button type="button" variant="outline" onClick={onRefresh} className="h-[42px]">
            Refresh requirements
          </Button>
        ) : null}
      </div>
    </form>
  );
}
