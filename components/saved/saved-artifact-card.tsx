"use client";

import type { SavedArtifactMetadata } from "@/lib/persistence/contracts";
import { Button } from "@/components/ui/button";

type Props = Readonly<{
  artifact: SavedArtifactMetadata;
  busy: boolean;
  confirmingDelete: boolean;
  onRestore: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}>;

function kindLabel(kind: SavedArtifactMetadata["kind"]): string {
  return kind === "comparison" ? "Comparison" : kind[0]!.toUpperCase() + kind.slice(1);
}

export function SavedArtifactCard({
  artifact,
  busy,
  confirmingDelete,
  onRestore,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: Props) {
  const savedAt = new Date(artifact.createdAt);
  return (
    <article className="rounded-xl border border-border bg-card p-5" aria-labelledby={`saved-${artifact.id}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{kindLabel(artifact.kind)} · Saved snapshot</p>
          <h2 id={`saved-${artifact.id}`} className="mt-2 break-words text-lg font-semibold">{artifact.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved {Number.isNaN(savedAt.valueOf()) ? artifact.createdAt : savedAt.toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onRestore}>Restore</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onRequestDelete}>Delete</Button>
        </div>
      </div>
      {confirmingDelete ? (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3" role="group" aria-label="Confirm saved snapshot deletion">
          <p className="text-sm">Delete this saved snapshot? This cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="destructive" disabled={busy} onClick={onConfirmDelete}>Delete snapshot</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onCancelDelete}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
