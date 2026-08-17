import Link from "next/link";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const modes = [
  {
    number: "01",
    href: "/research",
    title: "Research",
    description: "Build a source-backed dossier for a university or program.",
  },
  {
    number: "02",
    href: "/compare",
    title: "Compare",
    description: "Compare 2–4 options with your priorities and evidence coverage.",
  },
  {
    number: "03",
    href: "/guide",
    title: "Guide",
    description: "Map your profile to published requirements, gaps, and deadlines.",
  },
];

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-5 pt-12 sm:px-8 sm:pt-16 lg:px-[72px] lg:pt-[76px]">
      <section className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
        <div className="max-w-[760px]">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-primary">
            EVIDENCE-FIRST UNIVERSITY RESEARCH
          </p>
          <h1 className="mt-7 text-[42px] leading-[1.05] font-bold tracking-[-0.035em] sm:text-[52px] sm:leading-[1.06]">
            Choose a university with the evidence still attached.
          </h1>
          <p className="mt-5 max-w-[690px] text-base leading-7 text-muted-foreground sm:text-[18px]">
            Research programs, compare fit, and plan applications without losing track of where each fact came from or how current it is.
          </p>
          <div className="mt-9 flex flex-wrap gap-2">
            <Button asChild className="h-[42px] px-4">
              <Link href="/research">Start research</Link>
            </Button>
            <Button asChild variant="outline" className="h-[42px] px-4">
              <Link href="/guide">Build my profile</Link>
            </Button>
          </div>
        </div>

        <aside className="border-l-4 border-l-primary bg-surface-subtle p-6 ring-1 ring-border lg:min-h-[365px] lg:rounded-[10px]">
          <p className="text-sm font-semibold text-muted-foreground">Evidence preview</p>
          <h2 className="mt-3 text-[22px] font-bold">MSc Computer Science</h2>
          <p className="mt-1 text-sm text-muted-foreground">Example University</p>
          <div className="my-5 border-t border-border" />
          <EvidenceBadge status="verified" />
          <p className="mt-5 text-[13px] text-muted-foreground">Application deadline</p>
          <p className="mt-1 text-[22px] font-semibold">15 January 2027</p>
          <p className="mt-1 text-[13px] font-semibold text-link">Official graduate admissions page</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Illustrative metadata • example 2027 intake • not live research
          </p>
          <Badge className="mt-5 h-auto rounded-md border-0 bg-evidence-unknown-bg px-2.5 py-1 text-evidence-unknown-fg">
            1 source
          </Badge>
        </aside>
      </section>

      <section className="mt-20 sm:mt-24" aria-labelledby="modes-heading">
        <h2 id="modes-heading" className="text-2xl font-semibold tracking-tight">
          Three ways to use UniProof
        </h2>
        <div className="mt-5 grid gap-8 md:grid-cols-3 md:gap-6">
          {modes.map((mode) => (
            <article key={mode.href} className="border-t border-border pt-5">
              <p className="text-[11px] font-semibold text-primary">{mode.number}</p>
              <h3 className="mt-5 text-[22px] font-semibold">{mode.title}</h3>
              <p className="mt-2 max-w-[345px] text-sm leading-5 text-muted-foreground">
                {mode.description}
              </p>
              <Link
                className="mt-8 inline-flex min-h-11 items-center text-sm font-semibold text-link hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                href={mode.href}
              >
                Open {mode.title.toLowerCase()} →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
