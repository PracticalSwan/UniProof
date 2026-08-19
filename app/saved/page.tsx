import type { Metadata } from "next";

import { SavedArtifactsWorkspace } from "@/components/saved/saved-artifacts-workspace";

export const metadata: Metadata = {
  title: "Saved snapshots",
  description: "View and restore private UniProof snapshots saved to your account.",
};

export default function SavedPage() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 lg:py-16">
      <section aria-labelledby="saved-heading">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Private account history</p>
        <h1 id="saved-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Saved snapshots</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          Saved results are historical snapshots. Restoring one does not make its evidence current; refresh, re-run, or reassess explicitly when you want new evidence.
        </p>
        <div className="mt-8">
          <SavedArtifactsWorkspace />
        </div>
      </section>
    </main>
  );
}
