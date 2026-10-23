---
name: aip-plan
description: 'Turn an AI Platform brief, or a Copilot Plan-mode plan, into plan.md: repo-by-repo tasks with an owner (Developer or Platform Engineer) in dependency order, decisions with evidence and trade-offs, the cross-repo contract, change impact, a test strategy per task, docs and rollout. Use when planning, refining a Plan-mode plan, breaking down work, ordering cross-repo changes or estimating.'
license: OGL-UK-3.0
---

# Planning

Input: `brief.md`. Output: `plan.md` (template in [run-files.md](../aip-handoff/references/run-files.md)), including the plan record: which committed plan file each PR updates.

## Plan record in Git

`plan.md` is git-ignored working state. The plan reaches Git inside the work, never as a PR of its own:

- Each work PR carries its plan record: the item in `ai-platform-frontend/docs/plans/` (`implemented/` for what it builds, `remaining.md` for what is left), or for infra or workflow work with no frontend PR, the owning repo's plan file (for example `ai-platform-infra/docs/*-plan.md`).
- One docs PR per run, at the end, once the work is merged or released: the discovery-site design (if any) and built state, plus the frontend `docs/plans/` update when no work PR touched the frontend.

## Refining a Copilot Plan-mode plan

Plan mode drafts quickly but does not know this platform. Keep its useful research, then:

1. Map each step to a repo and an AC; drop steps with no AC, and add ACs the plan missed.
2. Check every assumption against built state and the design pack; flag conflicts.
3. Replace generic tests with the test strategy below.
4. Add the platform steps it misses: backfills, error codes, docs, discovery record, rollout.

## Task rules

- Each task sits in one repo with an owner from the routing table in `aip-handoff`. Group tasks into PRs by cohesion, not size: one PR per plan, feature or closely related features, or one complex refactor. Large is fine when it hangs together; never bundle unrelated features. Each PR leaves `main` shippable.
- Put each change in the layer that owns it; propose a split or a new service only on the criteria in `aip-architecture`.
- Each task names its ACs, the tests to write first, and the gate that proves it.
- Prefer extending an existing route, service, adapter, module or component over a new one; name the pattern to copy (`aip-clean-code`).
- Build to the current design only. No legacy paths, flags kept "just in case" or old-and-new code; removal of anything live goes through `aip-change-impact`.
- Each non-obvious choice goes in the Decisions table with its evidence (`aip-evidence`); at most three options.
- CDP work a person must do (config PR, secret, egress allow-list, redeploy) is a rollout task (`aip-cdp`).
- Independent tasks in different repos can run in parallel; say so.

## Dependency order

| Kind of change     | Order                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direction changes  | `ai-platform-discovery-docs` design and decision written first, then build; it ships in the end-of-run docs PR                                                                     |
| Portal feature     | `ai-platform-backend-api` (route, service, tests) then `ai-platform-frontend` (`api-client.js`, views) then journey tests                                                          |
| Persisted field    | Readers tolerate absence, plus a backfill entry when anything queries it; a rename is expand, backfill, then contract in a later change (backend `schema-changes.instructions.md`) |
| Infrastructure     | `ai-platform-infra` (modules, schemas, catalogue) then release then `ai-platform-environments` parameters then pins and applies                                                    |
| Reusable workflows | `ai-platform-workflows` release, then callers; a breaking change is a new major                                                                                                    |
| Catalogue          | Infra release, then the backend's `CATALOGUE_REF`                                                                                                                                  |
| Built-state record | After merge or release: discovery-docs `build-stories.md#status`, in the one end-of-run docs PR                                                                                    |

Never plan hand edits to `ai-platform-tenants` or `ai-platform-deployments` environment files: they are written by `submit.yml`.

## Test strategy (per task)

List the positive, negative and edge cases per AC (`aip-test-design`), then the layer:

| Change                          | Must have                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Backend route, service, adapter | Minimum scenarios in `aip-test-node`; port contract tests for adapters                                |
| Frontend page, component        | Controller and template tests (`aip-test-node`); axe, keyboard and no-JS checks (`aip-accessibility`) |
| Journey                         | One WDIO spec per journey (`aip-test-journey`)                                                        |
| Terraform                       | `.tftest.hcl` positive, negative (`expect_failures`) and edge runs (`aip-build-terraform`)            |
| Workflow or script              | Unit and integration tests; actionlint and shellcheck clean (`aip-build-gitops`)                      |
| Bug fix                         | A regression test that fails before the fix                                                           |

Coverage: at least 90 percent overall and never lower than the base; 100 percent on error and security paths.

## Plan quality check (before G1)

- Every AC maps to at least one task and one test; every task maps to an AC.
- Contract (with additive or breaking stated), error codes and persisted fields are explicit; the Impact line is filled in.
- Each PR has one purpose a reviewer can state in a sentence; unrelated features are in separate PRs.
- Security, accessibility and personal-data impact stated, or "none" with a reason.
- Decisions cite evidence; nothing rests on "best practice" alone.
- The plan record names the committed plan file each PR updates, and the end-of-run docs PR is listed.
- Risks have an owner or a question for the user.
