"use client";

import type { GuideChecklistItem, GuideEvidenceRef } from "@/lib/guide/contracts";

interface GuideChecklistProps {
  items: readonly GuideChecklistItem[];
  onShowEvidence: (ref: GuideEvidenceRef, trigger: HTMLButtonElement) => void;
}

export function GuideChecklist({ items, onShowEvidence }: GuideChecklistProps) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="guide-checklist-heading" className="mt-8">
      <h3 id="guide-checklist-heading" className="text-[17px] font-semibold">Checklist</h3>
      <ol className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={item.id} className="rounded-md border border-border bg-white p-4 text-sm">
            <span className="font-semibold">{index + 1}.</span> {item.action}
            {item.evidenceRefs.length > 0 ? (
              <span className="ml-2 inline-flex flex-wrap gap-x-3 gap-y-1">
                {item.evidenceRefs.map((ref, evidenceIndex) => (
                  <button
                    key={`${ref.targetKey}:${ref.claimId}`}
                    type="button"
                    aria-label={item.evidenceRefs.length === 1
                      ? `View evidence for checklist item ${index + 1}`
                      : `View evidence for checklist item ${index + 1} (${evidenceIndex + 1} of ${item.evidenceRefs.length})`}
                    onClick={(event) => onShowEvidence(ref, event.currentTarget)}
                    className="inline-flex min-h-6 items-center text-[13px] font-semibold text-link underline underline-offset-4"
                  >
                    View evidence{item.evidenceRefs.length > 1 ? ` ${evidenceIndex + 1}` : ""}
                  </button>
                ))}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
