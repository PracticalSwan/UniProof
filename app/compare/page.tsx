import { ModeShell } from "@/components/layout/mode-shell";
import { CompareWorkspace } from "@/components/compare/compare-workspace";
import { researchCatalog } from "@/lib/research/catalog/data";

export default function ComparePage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-[1440px] px-5 pt-12 sm:px-8 lg:px-[72px] lg:pt-14"
    >
      <ModeShell
        eyebrow="Compare"
        title="Compare fit, not prestige."
        description="Set your priorities, research two to four supported options, and compare only evidence that passes deterministic compatibility gates. Missing evidence lowers coverage instead of becoming a zero."
      />
      <CompareWorkspace catalog={researchCatalog} />
    </main>
  );
}
