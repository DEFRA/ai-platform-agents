# Run file templates

Keep every file short. Link to sources; do not copy them.

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

| Repo | Gate result | Coverage (lines, branches, functions) | Scans |
| ---- | ----------- | ------------------------------------- | ----- |

| ID  | Severity | Lens     | Where           | Finding | Evidence | Expected fix           |
| --- | -------- | -------- | --------------- | ------- | -------- | ---------------------- |
| F1  | major    | security | path/file.js:42 | {issue} | {proof}  | {what good looks like} |

### Acceptance criteria

| AC  | Status (met, partial, unmet, untested) | Evidence |
| --- | -------------------------------------- | -------- |
```

## release.md

```markdown
| Repo | Branch | PR  | Checks | Sonar gate | Copilot rounds (max 3) | Copilot threads | Human review | Merged | Deployed |
| ---- | ------ | --- | ------ | ---------- | ---------------------- | --------------- | ------------ | ------ | -------- |
```

Copilot rounds: the review count from the API and the cap in `aip-pull-request`. List any review 3 comments left for the human under the table.
