"use client";

import { Button } from "@/components/ui/button";

interface CompareRunBannerProps {
  current: number;
  total: number;
  label: string;
  onCancel: () => void;
}

export function CompareRunBanner({ current, total, label, onCancel }: CompareRunBannerProps) {
  return (
    <section className="mt-8 rounded-lg border border-primary/30 bg-primary/5 p-4" aria-label="Comparison research progress">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-sm font-semibold">
          Researching option {current} of {total}: {label}
        </p>
        <Button type="button" variant="outline" className="min-h-10 self-start sm:self-auto" onClick={onCancel}>
          Cancel comparison
        </Button>
      </div>
    </section>
  );
}
