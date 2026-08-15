import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { ModeShell } from "@/components/layout/mode-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const categories = ["Admissions", "Tuition", "Scholarships", "Research", "Outcomes", "Support"];

const sections = [
  {
    title: "Admissions",
    description: "Minimum requirements, English language evidence, application window",
    status: "verified" as const,
    meta: "2 claims • 1 source",
  },
  {
    title: "Tuition & fees",
    description: "Published tuition by intake/academic year, currency and fee basis",
    status: "verified" as const,
    meta: "3 claims • 2 sources",
  },
  {
    title: "Scholarships",
    description: "Eligibility, amount, deadlines, source authority",
    status: "university-reported" as const,
    meta: "2 claims • 1 source",
  },
  {
    title: "Research",
    description: "Labs, faculty groups, research themes, publication signals",
    status: "verified" as const,
    meta: "2 claims • 1 source",
  },
];
export default function ResearchPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 pt-12 sm:px-8 lg:px-[72px] lg:pt-14">
      <ModeShell
        eyebrow="Research"
        title="Research a university or program."
        description="Ask a focused question or start from a university. Results are organized as claims with visible provenance, freshness, and uncertainty."
      />

      <section className="mt-10 rounded-lg border border-border bg-secondary p-4 sm:p-5" aria-label="Research query preview">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            className="h-12 bg-white px-4"
            placeholder="e.g. MSc Computer Science — tuition, admissions, research and scholarships"
            aria-label="Research question"
          />
          <Button type="button" aria-disabled="true" className="h-12 px-6 lg:self-start">
            Research
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Research categories">
          <span>Filters:</span>
          {categories.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </section>
      <section className="mt-12" aria-labelledby="research-dossier-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="research-dossier-heading" className="text-[22px] font-semibold">Research dossier</h2>
            <p className="mt-1 text-sm text-muted-foreground">Example University • MSc Computer Science</p>
            <p className="mt-1 text-xs text-muted-foreground">Illustrative UI preview • not a live research result</p>
          </div>
          <div className="flex flex-wrap gap-3" aria-label="Illustrative evidence summary">
            <span className="rounded-md bg-evidence-verified-bg px-2.5 py-1 text-xs font-semibold text-evidence-verified-fg">12 verified</span>
            <span className="rounded-md bg-evidence-conflicting-bg px-2.5 py-1 text-xs font-semibold text-evidence-conflicting-fg">2 conflicting</span>
            <span className="rounded-md bg-evidence-unknown-bg px-2.5 py-1 text-xs font-semibold text-evidence-unknown-fg">3 unknown</span>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_416px]">
          <div className="overflow-hidden rounded-lg border border-border bg-white">
            {sections.map((section, index) => (
              <article
                key={section.title}
                className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-start"
              >
                <div>
                  <h3 className="text-[17px] font-semibold">{section.title}</h3>
                  <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{section.description}</p>
                </div>
                <div className="sm:text-left">
                  <EvidenceBadge status={section.status} />
                  <p className="mt-3 text-xs text-muted-foreground">{section.meta}</p>
                  <a
                    href="#claim-evidence"
                    className="mt-2 inline-flex min-h-8 items-center text-[13px] font-semibold text-link hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    View evidence →
                  </a>
                </div>
                {index < sections.length - 1 ? (
                  <div className="col-span-full border-b border-border" aria-hidden="true" />
                ) : null}
              </article>
            ))}
          </div>

          <aside id="claim-evidence" className="rounded-lg border border-border border-l-[3px] border-l-primary bg-panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Claim evidence</h2>
            <EvidenceBadge className="mt-4" status="verified" />
            <p className="mt-5 text-lg font-semibold">Application deadline: 15 January 2027</p>
            <div className="my-6 border-t border-border" />
            <p className="text-xs text-muted-foreground">Source</p>
            <p className="mt-2 text-[15px] font-semibold">Example official university page</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Illustrative publisher metadata</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Retrieved date appears here</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Applicable intake appears here</p>
            <div className="my-6 border-t border-border" />
            <p className="text-xs text-muted-foreground">Supporting text</p>
            <p className="mt-3 text-sm leading-6">
              The exact source passage supporting the selected claim will appear here after live research is implemented.
            </p>
            <span
              aria-disabled="true"
              className="mt-7 inline-flex h-[42px] items-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground"
            >
              Open official source
            </span>
          </aside>
        </div>
      </section>
    </main>
  );
}
