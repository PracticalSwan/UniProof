import { ModeShell } from "@/components/layout/mode-shell";
import { GuideWorkspace } from "@/components/guide/guide-workspace";
import { researchCatalog } from "@/lib/research/catalog/data";

export default function GuidePage() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-5 pt-12 sm:px-8 lg:px-[72px] lg:pt-14">
      <ModeShell
        eyebrow="Guide"
        title="Turn requirements into a plan you can act on."
        description="Compare your profile with published requirements. UniProof distinguishes clear matches, gaps, missing applicant data, unclear requirements, and items that need manual confirmation."
      />

      <GuideWorkspace catalog={researchCatalog} />
    </main>
  );
}
