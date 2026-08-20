# UniProof Demo Script — Target 2:20–2:35

> Designed to leave speaking buffer under a three-minute Devpost video. Use the production URL. Do not expose provider keys, local terminals, private applicant information, or Devpost account details on screen.

## Before recording

Open `https://uniproof-beta.vercel.app` in a clean browser window. Keep the GitHub repository available in a separate tab only if needed at the end. Use invented profile data. Prefer a supported program whose public pages are currently responsive. If live Research returns incomplete evidence, do **not** retry repeatedly; use the fallback narration below and continue the product tour.

## 0:00–0:20 — Home / problem

**Screen:** Open UniProof and briefly show the navigation.

**Say:**

“International students have to combine admissions pages, program pages, scholarships, rankings, and community sources. AI can make that faster, but it can also hide where an answer came from. UniProof is evidence-first: important claims keep their sources, and missing, stale, conflicting, or incomplete information stays visible.”

**Action:** Click **Research**.

## 0:20–0:55 — Research

**Screen:** Research workspace.

**Action:** Search for a supported university/program, select one program, keep one or a few relevant categories selected, then click **Research** once.

**Say while it runs:**

“Research starts from a bounded supported catalog. On the server, UniProof searches public sources, retrieves them through an SSRF-resistant bounded transport, uses structured AI to extract and reconcile candidate facts, and then applies deterministic evidence rules before anything reaches the browser.”

**When a dossier appears:** point to evidence-status badges and click **View evidence** on one claim.

**Say:**

“The model is not the final authority. The application decides whether evidence is verified, corroborated, conflicting, outdated, inferred, anecdotal, unknown, or operationally incomplete. I can inspect the supporting text and exact source instead of trusting one generated paragraph.”

**If live Research is incomplete instead:**

“UniProof also fails visibly. This category did not complete, so it does not invent a claim. That same incomplete state prevents downstream comparison or guidance from treating the missing evidence as definitive.”

Then continue without repeated retries.

## 0:55–1:35 — Compare

**Action:** Close evidence if open. Click **Compare**. Select two compatible programs. Briefly move one or two priority sliders.

**Say:**

“Compare reuses the same Research evidence. I choose my own priorities with relative sliders; UniProof normalizes them deterministically. It never asks an AI model to rank universities.”

**Action:** If you have time and Research is behaving reliably, click **Compare** once. Otherwise show the form/sliders and use the repository screenshot or previously captured result only during video editing, clearly as a product screenshot rather than a live result.

**Say:**

“Only compatible, eligible evidence can score. Missing, conflicting, stale, inferred, anecdotal, or unit-incompatible facts reduce visible evidence coverage instead of becoming zero. The result is a user-fit comparison, not a prestige ranking.”

## 1:35–2:10 — Guide

**Action:** Click **Guide**. Select a supported program. Enter invented values such as a sample qualification, GPA, English score, and budget.

**Say:**

“Guide compares an applicant profile with published requirements, but the private profile values stay in the browser. Research receives only the public program plus optional intake and academic year.”

**Action:** Click **Assess** once if live Research is reliable; otherwise show the completed Guide screenshot during editing after showing the live form.

**Say:**

“The output is deterministic requirement states, risks, checklist items, and official next steps. UniProof does not predict admission probability. When evidence is missing or unclear, it asks for manual confirmation instead.”

## 2:10–2:30 — Architecture / close

**Screen:** Return to Home or briefly show GitHub README if desired.

**Say:**

“The hosted release uses Tavily with Brave fallback for discovery and Groq with OpenRouter fallback for structured AI. It has strict runtime schemas, bounded provider budgets, nonce CSP, no third-party runtime analytics, and deployment-layer rate limiting on Research. UniProof’s core idea is simple: AI can help interpret sources, but evidence policy should decide what the product is allowed to claim.”

**End screen:** UniProof name plus production URL.

## Recording fallback rules

- Do not repeatedly submit Research to force a successful provider outcome.
- Do not claim a live result if the screen is showing a deterministic release screenshot.
- If a live source fails, use the visible incomplete state as an evidence-first feature and move on.
- Keep the video focused on Research → Compare → Guide; skip login/save because hosted Auth is intentionally disabled for the hackathon release.
- Target a spoken recording around 2:20–2:35 so natural pauses remain under the approximately three-minute requirement.
