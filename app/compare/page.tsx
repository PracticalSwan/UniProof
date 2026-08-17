import { ModeShell } from "@/components/layout/mode-shell";
import { Button } from "@/components/ui/button";

const priorities = [
  ["Affordability", "30%"],
  ["Research", "30%"],
  ["Scholarships", "20%"],
  ["Outcomes", "20%"],
] as const;

const programs = [
  {
    shortName: "Example A",
    program: "MSc Computer Science",
    fit: 84,
    coverage: 92,
    scores: { Affordability: "82", Research: "94", Scholarships: "72", Outcomes: "86" },
    coverageLabel: "Strong coverage",
    coverageClass: "bg-evidence-verified-bg text-evidence-verified-fg",
  },
  {
    shortName: "Example B",
    program: "MSc Artificial Intelligence",
    fit: 81,
    coverage: 88,
    scores: { Affordability: "82", Research: "88", Scholarships: "79", Outcomes: "86" },
    coverageLabel: "Strong coverage",
    coverageClass: "bg-evidence-verified-bg text-evidence-verified-fg",
  },
  {
    shortName: "Example C",
    program: "MSc Machine Learning",
    fit: 79,
    coverage: 73,
    scores: { Affordability: "76", Research: "88", Scholarships: "72", Outcomes: "Unknown" },
    coverageLabel: "1 evidence gap",
    coverageClass: "bg-evidence-inferred-bg text-evidence-inferred-fg",
  },
];

export default function ComparePage() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-5 pt-12 sm:px-8 lg:px-[72px] lg:pt-14">
      <ModeShell
        eyebrow="Compare"
        title="Compare fit, not prestige."
        description="Your score reflects your priorities and only the evidence available. Missing evidence lowers coverage instead of being treated as a bad score."
      />

      <section className="mt-10 rounded-lg border border-border bg-secondary p-4 sm:p-5" aria-label="Illustrative comparison priorities">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[13px] font-semibold text-muted-foreground">Priorities</p>
            <div className="mt-3 flex flex-wrap gap-3 sm:gap-6">
              {priorities.map(([label, weight]) => (
                <span key={label} className="rounded-md border border-[#cfd6da] bg-[#f8f9f8] px-2.5 py-1 text-xs font-semibold text-primary">
                  {label} {weight}
                </span>
              ))}
            </div>
          </div>
          <Button type="button" variant="outline" disabled className="h-[42px] self-start px-4 lg:self-auto">
            Edit priorities
          </Button>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="comparison-heading">
        <div>
          <h2 id="comparison-heading" className="text-[22px] font-semibold">Comparison workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Illustrative UI preview • scores below are example values, not live university results.
          </p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {programs.map((program) => (
            <article key={program.shortName} className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-white p-5 sm:p-6">
              <h3 className="text-2xl font-bold">{program.shortName}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{program.program}</p>
              <div className="my-6 border-t border-border" />
              <p className="text-xs text-muted-foreground">Fit score</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-[44px] leading-none font-bold text-primary">{program.fit}</span>
                <span className="text-base">/100</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Evidence coverage {program.coverage}%</p>

              <dl className="mt-7">
                {Object.entries(program.scores).map(([label, score]) => (
                  <div key={label} className="flex items-center justify-between border-b border-border py-3 text-[13px]">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className={score === "Unknown" ? "font-semibold text-evidence-inferred-fg" : "font-semibold"}>
                      {score}
                    </dd>
                  </div>
                ))}
              </dl>

              <span className={`mt-7 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${program.coverageClass}`}>
                {program.coverageLabel}
              </span>
            </article>
          ))}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <h2 className="text-lg font-semibold">What the scores mean</h2>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-muted-foreground">
            In this illustrative example, a missing category reduces evidence coverage rather than receiving a zero or automatically lowering the fit score.
          </p>
        </div>
      </section>
    </main>
  );
}
