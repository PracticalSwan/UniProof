"use client";

import type { GuideEvidenceRef, GuideTimelineItem } from "@/lib/guide/contracts";

interface GuideTimelineProps {
  items: readonly GuideTimelineItem[];
  onShowEvidence: (ref: GuideEvidenceRef, trigger: HTMLButtonElement) => void;
}

export function GuideTimeline({ items, onShowEvidence }: GuideTimelineProps) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="guide-timeline-heading" className="mt-8">
      <h3 id="guide-timeline-heading" className="text-[17px] font-semibold">Timeline</h3>
      <ol className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border border-border bg-white p-4 text-sm">
            <span className="font-semibold">{item.date ?? "No published date"}</span>
            {item.urgent ? <span className="ml-2 text-xs font-semibold text-destructive">Urgent</span> : null}
            <p className="mt-1">{item.action}</p>
            {item.evidenceRefs.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {item.evidenceRefs.map((ref, index) => (
                  <button
                    key={`${ref.targetKey}:${ref.claimId}`}
                    type="button"
                    aria-label={item.evidenceRefs.length === 1
                      ? `View evidence for ${item.action}`
                      : `View evidence for ${item.action} (${index + 1} of ${item.evidenceRefs.length})`}
                    onClick={(event) => onShowEvidence(ref, event.currentTarget)}
                    className="inline-flex min-h-6 items-center text-[13px] font-semibold text-link underline underline-offset-4"
                  >
                    View evidence{item.evidenceRefs.length > 1 ? ` ${index + 1}` : ""}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
