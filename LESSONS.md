# LESSONS.md — UniProof

> **MANDATORY READ RULE:** This is the first manual project file every agent must read at the start of every session, before code inspection, planning, or edits.
>
> Record only reusable mistakes, explicit user corrections, recurring environment pitfalls, root causes, and durable preventive actions. Keep project status and temporary plans out of this file.

## Entry Format

| Date | Context | What happened | Root cause | Durable corrective action |
| --- | --- | --- | --- | --- |

## Log

| Date | Context | What happened | Root cause | Durable corrective action |
| --- | --- | --- | --- | --- |
| 2026-08-16 | Repository initialization | Project governance was created with `LESSONS.md` as the mandatory first manual session read. | Cross-agent work needs a durable way to avoid repeating known mistakes. | Keep this read rule in root `AGENTS.md`, and append only lessons that are likely to matter again. |
| 2026-08-16 | Windows workspace creation | A nested PowerShell wrapper mangled a variable and a second command used an unsupported `New-Item -LiteralPath` form in the connected shell. | Command quoting and shell capability were assumed instead of using the simplest native path operation. | On this host, prefer explicit `cmd.exe` directory creation for new paths with spaces, or verify PowerShell syntax before relying on nested quoting. |
| 2026-08-16 | Next.js metadata icon | Writing `app/icon.svg` through the generic file writer produced bytes that Next.js rejected as invalid UTF-8, causing the dev route to return HTTP 500 until the asset was rewritten explicitly as UTF-8 bytes. | The SVG path was treated differently from ordinary text and its encoding was not verified after creation. | For Next.js SVG metadata assets on this host, write with an explicitly UTF-8-safe method and immediately verify a live route or production build before continuing. |
