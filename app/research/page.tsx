import { ModeShell } from "@/components/layout/mode-shell";
import { ResearchWorkspace } from "@/components/research/research-workspace";
import { researchCatalog } from "@/lib/research/catalog/data";

export default function ResearchPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 pt-12 sm:px-8 lg:px-[72px] lg:pt-14">
      <ModeShell
        eyebrow="Research"
        title="Research a university or program."
        description="Start from a supported university or program. Results are organized as claims with visible provenance, freshness, and uncertainty."
      />

      <ResearchWorkspace catalog={researchCatalog} />
    </main>
  );
}
