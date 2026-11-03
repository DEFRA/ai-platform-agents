# Run file templates

Keep every file short. Link to sources; do not copy them.

## state.md

Rewritten, never appended; at most 30 lines. A fresh chat reads this first (`aip-run-control`).

```markdown
# State: {yyyy-mm-dd}-{slug}

Updated: {yyyy-mm-dd hh:mm} by {agent} | Autonomy: {guided | standard | full} | Stage: {plan | build | review | docs | release | deploy | record | closed}

## Now

{One to three lines: what is happening, what is next, what the user must decide.}

## Groups

| Group | Repo | Branch @ head | PR  | pr-state | Open items | Next |
| ----- | ---- | ------------- | --- | -------- | ---------- | ---- |

## Waiting

| What                  | Until (UTC)   | Then (exact command)                                     |
| --------------------- | ------------- | -------------------------------------------------------- |
| Deferred bump {pkg@v} | {eligible at} | `npm update {pkg}`, `npm ci`, tests, commit the lockfile |

## Inbox (requests parked mid-run, verbatim)

- {yyyy-mm-dd hh:mm}: {the user's words}
```

## brief.md

```markdown
# {Title}

Run: {yyyy-mm-dd}-{slug} | Size: S, M or L | Source: {requirement, B## item, design page, spec or Plan-mode} | Live: {yes, no} ({source})

## Outcome

{One or two sentences: who gets what, and why.}

## Sources

- {Links: remaining.md#item, build-stories.md#bNN, design-*.md#anchor, decision D##, spec}

## Acceptance criteria

| ID  | Given / When / Then         | Source |
| --- | --------------------------- | ------ |
| AC1 | Given ... when ... then ... | {link} |

## Non-goals

- {What this run will not do}

## Constraints and decisions

- {Rule or decision, with link; user answers dated}

## Risks and open questions

- {Risk, impact, mitigation; or open question and who answers it}
```

## plan.md

```markdown
# Plan: {title}

Gates: G1 plan {pending|approved {date}} | G2 push and PR {..} | G3 deploy {..}
Impact: {none | BREAKING: what, who, mitigation | BACKFILL: collection, field} (aip-change-impact)

## Decisions

| Decision | Options considered | Chosen because (evidence) |
| -------- | ------------------ | ------------------------- |

## Tasks

| ID  | PR  | Owner     | Repo                    | Task     | ACs | Tests to add                | Status | Evidence |
| --- | --- | --------- | ----------------------- | -------- | --- | --------------------------- | ------ | -------- |
| T1  | P1  | Developer | ai-platform-backend-api | {change} | AC1 | {route test: 201, 400, 409} | todo   |          |

PR groups: P1 = {one purpose, e.g. "credential expiry feature (backend)"}. Group by plan, feature or related features; never unrelated ones.

## Contract

{Cross-repo shape: endpoint, method, request, response, error codes. Omit when single repo.}

## Test strategy

{Unit, integration, journey, accessibility, Terraform and security checks per task, and coverage target.}

## Docs and record

- Plan record per PR: {P1: file and entry, e.g. `ai-platform-frontend/docs/plans/implemented/NN-*.md` and `implemented-features.md`; remaining parts in `remaining.md`}
- Same-PR docs: {READMEs, instructions, `build-plan.md`}
- End-of-run docs PR: {discovery design and built state; frontend `docs/plans/` if no work PR touched the frontend}

## Rollout

{Merge order, release, pins, environments, rollback. Omit when nothing deploys.}
```

## log.md entry

```markdown
## {yyyy-mm-dd hh:mm} {Agent} {stage}: {STATUS}

{At most 8 lines: what changed, evidence, next.}
```

## review.md round

```markdown
## Round {n}: {PASS | CHANGES-REQUIRED | BLOCKED}

Reviewed: {repo}@{sha} (or tree fingerprint), one per repo. Later fix-pass commits listed in `log.md` are covered by this round.

| Repo | Gate result | Coverage (lines, branches, functions) | Scans |
| ---- | ----------- | ------------------------------------- | ----- |

| ID  | Severity | Lens     | Where           | Finding | Evidence | Expected fix           |
| --- | -------- | -------- | --------------- | ------- | -------- | ---------------------- |
| F1  | major    | security | path/file.js:42 | {issue} | {proof}  | {what good looks like} |

### Acceptance criteria

| AC  | Status (met, partial, unmet, untested) | Evidence |
| --- | -------------------------------------- | -------- |

### Copilot threads (one row per open PR)

Within the cap (Copilot reviews 1 to 3) nothing may be left unresolved: an unresolved thread is a finding owned by the builder and the verdict is `CHANGES-REQUIRED`. From review 4 (cap reached) run `pr-state.mjs` once more; whatever is still unresolved is listed for the human and does not block. A pending review is reported as pending, never as "nothing unresolved".

| Repo and PR  | Copilot reviews (mode) | pr-state       | Unresolved | Result                                    |
| ------------ | ---------------------- | -------------- | ---------- | ----------------------------------------- |
| backend#58   | 2 (auto)               | SETTLED        | 0          | OK: all resolved                          |
| workflows#17 | 3 (auto)               | THREADS-OPEN   | 2          | Findings F7, F8 (owner Platform Engineer) |
| worker#1     | 5 (human-only)         | THREADS-OPEN   | 1          | Listed for the human, not a finding       |
| infra#31     | 2 (auto)               | REVIEW-PENDING | n/a        | Pending: check again, do not pass         |

For the human reviewer (cap reached only): `PRRT_xxx src/a.js:42 one-line summary`.
```

## release.md

```markdown
| Repo | Branch | PR  | Checks | Sonar gate | Copilot rounds (count, mode) | Copilot threads | Human review | Merged | Deployed |
| ---- | ------ | --- | ------ | ---------- | ---------------------------- | --------------- | ------------ | ------ | -------- |
```

Copilot rounds: the review count and handling mode from the `COPILOT` line of `pr-state.mjs` (auto for reviews 1 to 3, human-only from 4) per `aip-pull-request`; a review is always requested, once per head. List any human-only comments under the table. The PR's current `STATE` goes in `state.md`.
