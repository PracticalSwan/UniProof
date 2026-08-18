"use client";

import * as React from "react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  categoryLabel,
  formatClaimValue,
  formatIsoDate,
  formatRetrievedAt,
  sourceTypeLabel,
} from "@/lib/research/mode/format";
import type { ResearchDossier } from "@/lib/research/mode/public-contracts";

interface ClaimEvidenceSheetProps {
  dossier: ResearchDossier | null;
  selectedClaimId: string | null;
  triggerElement: HTMLButtonElement | null;
  onClose: () => void;
}

export function ClaimEvidenceSheet({
  dossier,
  selectedClaimId,
  triggerElement,
  onClose,
}: ClaimEvidenceSheetProps) {
  const selectedClaim = selectedClaimId === null || dossier === null
    ? undefined
    : dossier.categories.flatMap((row) => row.claims).find((claim) => claim.id === selectedClaimId);
  const sourcesById = React.useMemo(
    () => new Map((dossier?.sources ?? []).map((source) => [source.id, source])),
    [dossier],
  );

  const orderedSources = React.useMemo(() => {
    if (selectedClaim === undefined) return [];
    const representative = sourcesById.get(selectedClaim.representativeSourceId);
    const remaining = selectedClaim.sourceIds
      .filter((id) => id !== selectedClaim.representativeSourceId)
      .map((id) => sourcesById.get(id));
    if (representative === undefined || remaining.some((source) => source === undefined)) {
      return null;
    }
    return [representative, ...remaining] as ResearchDossier["sources"];
  }, [selectedClaim, sourcesById]);

  const target = dossier?.target;
  const metadata: string[] = [];
  if (selectedClaim?.academicYear !== undefined) {
    metadata.push(`Academic year ${selectedClaim.academicYear}`);
  }
  if (selectedClaim?.intake !== undefined) metadata.push(`Intake ${selectedClaim.intake}`);
  if (selectedClaim?.effectiveDate !== undefined) {
    metadata.push(`Effective ${formatIsoDate(selectedClaim.effectiveDate)}`);
  }

  return (
    <Sheet
      open={selectedClaim !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (triggerElement !== null && triggerElement.isConnected) {
            triggerElement.focus();
          }
        }}
      >
        {selectedClaim === undefined ? null : (
          <>
            <SheetHeader>
              <SheetTitle>{selectedClaim.property}</SheetTitle>
              <SheetDescription>
                {categoryLabel(selectedClaim.category)} claim evidence
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5">
              <section aria-label="Claim value and status" className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="min-w-0 break-words text-[15px] leading-6 font-semibold">
                    {formatClaimValue(selectedClaim)}
                  </p>
                  <EvidenceBadge status={selectedClaim.verificationStatus} />
                </div>
                {metadata.length > 0 ? (
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {metadata.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </p>
                ) : null}
              </section>

              <section aria-label="Supporting text" className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Supporting text
                </p>
                <blockquote className="break-words border-l-[3px] border-l-primary/60 bg-panel p-4 text-sm leading-6 [overflow-wrap:anywhere]">
                  {selectedClaim.supportingText}
                </blockquote>
              </section>

              <section aria-label="Evidence sources" className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Evidence sources
                </p>
                {orderedSources === null ? (
                  <p role="alert" className="text-sm text-destructive">
                    Evidence source details are unavailable for this claim.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {orderedSources.map((source, index) => (
                      <li
                        key={source.id}
                        className="rounded-md border border-border bg-white p-4"
                      >
                        <p className="text-[13px] font-semibold text-muted-foreground">
                          {index === 0 ? "Representative source" : `Source ${index + 1}`}
                        </p>
                        <p className="mt-2 min-w-0 break-words text-[15px] font-semibold">
                          {source.title}
                        </p>
                        <p className="mt-1 break-words text-[13px] text-muted-foreground">
                          {source.publisher}
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {sourceTypeLabel(source.sourceType)}
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          Retrieved {formatRetrievedAt(source.retrievedAt)}
                        </p>
                        {source.effectiveDate !== undefined ? (
                          <p className="mt-1 text-[13px] text-muted-foreground">
                            Source effective {formatIsoDate(source.effectiveDate)}
                          </p>
                        ) : null}
                        {source.academicYear !== undefined ? (
                          <p className="mt-1 text-[13px] text-muted-foreground">
                            Source academic year {source.academicYear}
                          </p>
                        ) : null}
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className="mt-3 inline-flex min-h-8 items-center break-all text-[13px] font-semibold text-link underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          Open source: {source.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {target === undefined ? null : (
                <section aria-label="Official target links" className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Official target
                  </p>
                  <div className="flex flex-col gap-2">
                    {target.program !== undefined ? (
                      <a
                        href={target.program.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="inline-flex min-h-10 items-center break-all rounded-md border border-border bg-white px-3 py-2 text-[13px] font-semibold text-link underline underline-offset-4 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        Official program page: {target.program.name}
                      </a>
                    ) : null}
                    <a
                      href={target.university.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="inline-flex min-h-10 items-center break-all rounded-md border border-border bg-white px-3 py-2 text-[13px] font-semibold text-link underline underline-offset-4 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      Official university website: {target.university.name}
                    </a>
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
