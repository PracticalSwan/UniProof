# Phase 1B — UI Foundation + Environment Boundaries

## Scope

Complete the approved Figma-derived application foundation without starting live research, AI orchestration, authentication, persistence, comparison scoring, or Guide logic.

## Implementation sequence

1. Reconcile the partially present Phase 1B scaffold with the revised Figma visual system.
2. Keep the existing minimal shadcn/ui installation and remove no useful primitives.
3. Map Figma colors, radius, focus, and evidence-state semantics into `app/globals.css`.
4. Update the shared header/footer and evidence badge components.
5. Implement responsive Home, Research, Compare, and Guide shells from the revised Figma frames.
6. Keep every displayed university/program/profile value explicitly illustrative rather than live-researched.
7. Verify Zod environment separation and Supabase browser/server clients against current official guidance.
8. Keep domain contracts limited to EvidenceStatus, University, Program, Source, and Claim.
9. Run typecheck, lint, production build, dependency audit, workspace verification, live route checks, responsive screenshots, keyboard checks, and console/runtime inspection.
10. Append verified completion state to `AGENT_MEMORY.md`; update `LESSONS.md` only if a reusable lesson occurs.

## Protected boundaries

- Do not initialize Git or create commits, branches, remotes, PRs, or deployments.
- Do not add real secrets.
- Do not call Tavily/OpenAI or implement outbound retrieval.
- Do not enable private persistence before RLS exists.
