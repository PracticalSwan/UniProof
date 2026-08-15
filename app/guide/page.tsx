import { ModeShell } from "@/components/layout/mode-shell";
import { Button } from "@/components/ui/button";

const profileFields = [
  ["Target", "MSc Computer Science • 2027"],
  ["Citizenship", "Malaysia"],
  ["Current country", "Thailand"],
  ["Qualification", "BSc Computer Science"],
  ["GPA", "3.40 / 4.00"],
  ["English test", "IELTS 7.0"],
  ["Budget", "THB 1.2M total"],
] as const;

const requirements = [
  { label: "Bachelor’s degree in computing or related field", status: "Meets", className: "bg-evidence-verified-bg text-evidence-verified-fg" },
  { label: "Minimum GPA / grade equivalency", status: "Manual confirmation", className: "bg-evidence-inferred-bg text-evidence-inferred-fg" },
  { label: "English language requirement", status: "Meets", className: "bg-evidence-verified-bg text-evidence-verified-fg" },
  { label: "Prerequisite mathematics coursework", status: "Missing applicant info", className: "bg-evidence-corroborated-bg text-evidence-corroborated-fg" },
  { label: "Application deadline", status: "Published", className: "bg-evidence-university-bg text-evidence-university-fg" },
];

export default function GuidePage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 pt-12 sm:px-8 lg:px-[72px] lg:pt-14">
      <ModeShell
        eyebrow="Guide"
        title="Turn requirements into a plan you can act on."
        description="Compare your profile with published requirements. UniProof distinguishes clear matches, gaps, missing applicant data, unclear requirements, and items that need manual confirmation."
      />

      <p className="mt-3 text-xs text-muted-foreground">
        Illustrative UI preview • profile and assessment values below are examples only.
      </p>

      <div className="mt-10 grid gap-7 xl:grid-cols-[372px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Applicant profile</h2>
          <dl className="mt-5 space-y-5">
            {profileFields.map(([label, value], index) => (
              <div key={label} className={index === 0 ? "border-b border-border pb-5" : undefined}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-sm font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <Button type="button" variant="outline" aria-disabled="true" className="mt-8 h-[42px] px-4">
            Edit profile
          </Button>
        </aside>

        <section aria-labelledby="requirements-heading">
          <h2 id="requirements-heading" className="text-[20px] font-semibold">
            Requirement assessment
          </h2>

          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-white">
            {requirements.map((requirement, index) => (
              <article key={requirement.label} className="p-5 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{requirement.label}</p>
                    <span className={`mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${requirement.className}`}>
                      {requirement.status}
                    </span>
                  </div>
                  <span aria-disabled="true" className="text-[13px] font-semibold text-link">
                    View evidence →
                  </span>
                </div>
                {index < requirements.length - 1 ? (
                  <div className="mt-5 border-b border-border" aria-hidden="true" />
                ) : null}
              </article>
            ))}
          </div>

          <aside className="mt-8 rounded-lg border border-[#d4dce3] bg-accent p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold">Next actions</h2>
            <ol className="mt-3 space-y-2 text-sm leading-5">
              <li>1. Add or verify prerequisite mathematics coursework</li>
              <li>2. Confirm grade equivalency with the admissions office</li>
              <li>3. Prepare required documents before the published deadline</li>
            </ol>
            <Button type="button" aria-disabled="true" className="mt-6 h-[42px] px-4 sm:float-right sm:mt-[-42px]">
              Build full checklist
            </Button>
            <div className="clear-both" />
          </aside>
        </section>
      </div>
    </main>
  );
}
