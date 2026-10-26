---
name: aip-handoff
description: 'Run folder, delegation prompt, return contract, evidence rule and fast-working rules shared by every AIP agent. Use when delegating to or returning from an AIP agent, starting or resuming a run, or writing brief.md, plan.md, log.md, review.md or release.md.'
user-invocable: false
license: OGL-UK-3.0
---

# AIP handoff contract

Every stage runs in a fresh context: the Orchestrator starts each as a subagent, or the user runs `/aip-resume` in a new chat. Handoff buttons continue the same chat, so use them only for a quick step. Agents share state through files, not chat.

## Work fast, in the right direction

- Smallest change that meets the ACs; decide with evidence (`aip-evidence`), then move.
- Ask only questions whose answer changes scope, design, security or tests; always offer a recommendation. If in doubt, ask; never guess.
- Ship each PR group in `plan.md` when it passes review, rather than waiting for the whole plan; never bundle unrelated features.
- Depth by size: **S** one repo, no design change; **M** one or two repos or a contract; **L** cross-repo, design, infra or identity. S skips ceremony: five-line brief, one review pass.
- Use tools well: search before reading; read large ranges once; run independent reads and Explore subagents in parallel; send long command output to a file and read only what matters; use the gate and scan scripts instead of ad hoc commands.
- Write short: tables over prose, links over copies, no restating what a file already says.

## Evidence rule

Every `done` claim carries evidence: a command and its result line, `path:line`, a test name, a run URL or a dated source. No evidence means `UNVERIFIED` (see `aip-evidence`). The Orchestrator treats a return without evidence as not done.

## Run folder

`ai-platform-agents/.copilot-tracking/runs/{yyyy-mm-dd}-{slug}/` is working state, git-ignored. The durable record is the plan record committed in each work PR and the one end-of-run docs PR (aip-plan).

| File         | Written by                                | Holds                                                  |
| ------------ | ----------------------------------------- | ------------------------------------------------------ |
| `brief.md`   | Planner                                   | Requirement, sources, ACs, non-goals, answers, risks   |
| `plan.md`    | Planner; builders and Reviewer set status | Tasks per repo and owner, gates, status, evidence      |
| `log.md`     | Every agent, append only                  | One entry of at most 10 lines per stage                |
| `review.md`  | Reviewer                                  | Verdict, gate table, findings; latest round on top     |
| `release.md` | Releaser                                  | Branches, commits, PRs, checks, threads, deploy status |
| `gates/`     | Builders, Reviewer                        | Full gate and scan logs                                |

Templates: [run-files.md](./references/run-files.md).

## Who builds what

| Repo                                                                                  | Agent                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-platform-frontend`, `-backend-api`, `-journey-tests`, `-agents`, `-gitops-worker` | AIP Developer                                                                                                                                                                           |
| `ai-platform-infra`, `-workflows`, `-environments`                                    | AIP Platform Engineer                                                                                                                                                                   |
| `ai-platform-tenants`, `-deployments`                                                 | AIP Platform Engineer for caller workflows, CODEOWNERS and README only; `environments/` state is never edited by hand (the guard denies it) and the AIP Releaser dispatches it after G3 |
| `ai-platform-discovery-docs`                                                          | AIP Planner (design), AIP Docs (built state)                                                                                                                                            |

A task that crosses the line goes back as `needs-input`; the Orchestrator routes it.

## Delegation prompt (Orchestrator to agent)

```text
MODE: delegated
RUN: {absolute run folder path}
STAGE: plan | build | review | docs | release | deploy | record
SIZE: S | M | L
OBJECTIVE: {one sentence}
SCOPE: {repos, task ids or finding ids}
INPUTS: {files to read; the user's answers verbatim}
CONSTRAINTS: {gates approved (G1/G2/G3), paths off limits, anything not to do}
DONE WHEN: {measurable outcome}
```

Pass paths, ids and the user's words verbatim. Never paste file contents or earlier summaries in full.

## Return contract (agent to Orchestrator), at most 15 lines

```text
STATUS: done | needs-input | blocked | failed
SUMMARY: {1 to 3 lines}
CHANGED: {files or PR links, or none}
EVIDENCE: {one line per task or claim: command and result, path:line, test name, URL}
UNVERIFIED: {claims not proven, or none}
QUESTIONS: {needs-input only: numbered, options, trade-off in one line, recommended option}
NEXT: {recommended next stage, or the main risk}
```

## Rules

- `MODE: delegated` means you cannot talk to the user. When an answer would change scope, design, security or tests, return `needs-input`; never guess.
- User-invoked (no `MODE` line): ask with the ask-questions tool, at most five questions, each with options and a recommendation.
- Task status in `plan.md`: `todo`, `doing`, `done` (builder, with evidence), `verified` (Reviewer only), `blocked`, `superseded` (replaced by a plan revision).

## Tools every agent should use

- **Todo list** for any work of three or more steps: one item per task or finding id from `plan.md`, one `in-progress` at a time, ticked as each finishes. It is the live view; `plan.md` stays the record.
- **Ask** (user-invoked only) with the ask-questions tool rather than prose questions; delegated agents return `needs-input`.
- **Explore subagent** for wide read-only searches across repos, so your own context stays small.
- **Diagnostics** before claiming done: `read/problems` after edits, `execute/testFailure` for a failing test, `search/usages` and `search/changes` before a rename or a review.
- **GitHub search** (`githubRepo`, `githubTextSearch`, `github/*`) for proven patterns in DEFRA repositories before inventing one; cite what you used.
- **Memory** (local to this machine, never shared or reviewed): read it at the start for gotchas and preferences, but treat every entry as a hint to verify, never as evidence. Write only verified, reusable facts with their source: `/memories/repo/` for repo commands and gotchas, `/memories/` for the user's preferences, `/memories/session/` for working notes. The run folder stays the record. Never store secrets, personal data or tenant identifiers. A fact the team needs goes into the repo's instructions by PR, then out of memory.
- **Browser** to prove behaviour in a real run (pages, PR and CI pages); **web** for dated external sources.
- Resume: read `brief.md`, `plan.md` and the last three `log.md` entries only.
- No secrets, tokens, personal data or full resource IDs in any run file.
