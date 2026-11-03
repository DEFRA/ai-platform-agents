---
name: aip-run-control
description: 'Keep an AI Platform run fast, bounded and resumable: when a review, fix, Copilot or release loop is settled, review freshness by commit not by clock, one request per head and one sweep per ship, never waiting on the clock (the 7-day package-age rule), mid-run messages without losing work, resuming a cancelled subagent, and orienting in a new chat without being handed context. Use when a run is looping or slow or costly, a message arrives mid-run, a subagent was cancelled, resuming in a fresh chat.'
license: OGL-UK-3.0
---

# Run control

Loops, waits and lost context cost more than the work itself. These rules end each loop in a named state, cap the cost, and let any fresh chat pick up from files. The run is autonomous between gates G1 to G3, so these rules are what stop it running away. The Orchestrator applies them; the Releaser and Reviewer follow the parts that name them.

## 1. A loop ends in a named state

| Loop              | Ends when                                                                         | Never                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Review (Reviewer) | One round and one fix pass with evidence, unless the second-review criteria apply | Start a round because a push is newer than the review                                                                              |
| Copilot (per PR)  | `pr-state.mjs` says `SETTLED` or `HUMAN-REVIEW`, or the cap (section 3) stops it  | Request while `REVIEW-PENDING` or when the newest Copilot review is already of the head; call a PR clear while a review is pending |
| Release sweep     | One pass over the PRs in the group, acting only on each PR's `pr-state` result    | Start a second "last sweep", or re-mark ready, re-post bodies or re-request what the state does not call for                       |
| Fix pass          | Every finding has evidence and the affected tests pass                            | Re-run the whole suite or re-review "to be sure"                                                                                   |

## 2. Freshness is by commit, never by clock

- A review covers commits. The round header in `review.md` lists `Reviewed: <repo>@<sha>` (or the tree fingerprint from `run-gates.mjs` when not committed).
- A later commit is **covered**, and never triggers a review or a hand-off, when it fixes that round's findings with evidence in `log.md`, is docs-only, or is a Releaser push of already-reviewed commits.
- Copilot likewise: compare the SHA of the newest Copilot review with the PR head (`pr-state.mjs`), not the time of the review with the time of the push.

## 3. Copilot: one request per head, one batch per round

Policy is unchanged: request a Copilot review after every push that changes the PR; reviews 1 to 3 are fixed and resolved automatically and from the fourth are listed for the human (`aip-pull-request`). What this adds:

- **One request per head.** Ask only for `NO-COPILOT-REVIEW` or `UNREVIEWED-HEAD`, after the last push of a round.
- **One batch per round.** Collect every open thread and review-body finding, send the ids to the owning builder once, expect one push, then one request.
- **Wait in the script, not in tokens.** `pr-state.mjs --wait 10` polls free of charge while a review or checks are pending. Still pending after that: record it under Waiting in `state.md`, report `pending` with the command to re-check, and stop. Never report "no unresolved threads" while a review is pending.

## 4. Never wait on the clock

A wait longer than about 15 minutes is **parked**, not polled: write it under Waiting in `state.md` with the time it ends and the exact command to run then, tell the user, and carry on with other groups or stop.

The 7-day package-age rule is the usual cause. Each repo's `.npmrc` sets `min-release-age=7` (Defra Node standard, `aip-defra-standards`), so npm refuses any version published in the last 7 days (`ETARGET`), and Dependabot waits the same. A fix inside that window is a **deferred bump**:

1. Find when it becomes eligible: `npm view <package> time --json`, then add 7 days to the version's publish time (PowerShell: `(npm view fast-uri time --json | ConvertFrom-Json).'3.1.9'`).
2. Do not bypass the rule, wait for it, or loop on it. Record `Deferred bump: <package>@<version> eligible <UTC time>; then npm update <package>, npm ci, tests, commit the lockfile` under Waiting in `state.md` and in the PR body.
3. A moderate or high `npm audit` finding fixed only by a version inside the window is a WARN, not a blocker and not a reason for another review round. A critical one in production dependencies goes to the user: wait, or an exception they approve.

## 5. Messages that arrive mid-run

In VS Code a message sent during a run **steers** it and cancels running subagents by default. Choose **Add to Queue** in the Send menu, or set `chat.requestQueuing.defaultAction` to `queue`, so a new request waits for the stage to finish.

When a message arrives anyway, the Orchestrator classifies it first:

| Message                                             | Do                                                                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Answers a pending question or corrects current work | Apply it to the current stage.                                                                                                                                                                          |
| A new or extra request                              | Park it as a todo `PARKED: <words verbatim>`, tell the user it is queued after the current stage, pass it to the next stage agent to log under Inbox in `state.md`, and raise it at the stage boundary. |
| Stop, or urgent                                     | Act now.                                                                                                                                                                                                |

If the steer cancelled a subagent, resume it (section 6); never restart the stage, and never start the new request on top of it.

## 6. A cancelled or crashed subagent resumes, it does not restart

- Every stage agent appends a one-line `checkpoint:` to `log.md` after each task or finding id it finishes.
- The Orchestrator re-delegates the same stage with `RESUME: yes`, the same `SCOPE`, and the instruction: read the checkpoints, audit `git status` and `git diff --stat` in each repo, keep partial work only after verifying it, do only the unfinished ids.
- The agent states in its return which work it kept and which it redid.

## 7. Orient in a new chat

A message about "the PR", "those comments", "the run", a branch, a repo, a finding or a `B##` item is a **continue**, not a start. Never ask for a link first.

1. Newest folder in `ai-platform-agents/.copilot-tracking/runs/` (or the one named): read `state.md`, then the last three `log.md` entries; `brief.md` and `plan.md` only when the question needs them.
2. Live state needs commands, which the Orchestrator cannot run: delegate one **status-only** call to the Releaser (`OBJECTIVE: status only`). It runs `node .github/skills/aip-pull-request/scripts/pr-state.mjs --repo DEFRA/<repo> --pr <n>` for each PR in `state.md` and `git status --short` with the branch for each repo in `plan.md`, rewrites `state.md`, and changes nothing else (no requests, pushes, replies or resolves).
3. Read `/memories/repo/` for hints; verify before relying on them.
4. Answer, or act within the stage, from that. Ask only when there is no run folder and no reference at all.

`state.md` is the one-screen snapshot that makes this cheap; the template is in [run-files.md](../aip-handoff/references/run-files.md).
