---
name: aip-build-gitops
description: 'Build AI Platform GitOps and CI changes: reusable GitHub Actions workflows, composite actions, src modules and bash scripts in ai-platform-workflows, plus the state and configuration repos (ai-platform-environments, -tenants, -deployments). Who may write what, the order, commands and the one divergence from Defra CI standards. Use when changing .github/workflows, actions, scripts/*.sh, registry.json, tfvars or desired-state flow.'
license: OGL-UK-3.0
---

# Build: workflows and GitOps state

The rules are each repo's `.github/copilot-instructions.md` ("Review first" and "Conventions"): injection safety, permissions, safeguards, release types, canonical form, blast radius. Read the one you are changing; this skill does not restate them.

## Repos

| Repo                       | Who writes                                       | What an agent may do                                                              |
| -------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `ai-platform-workflows`    | Engineers by PR; release-please                  | Workflows, actions, `src/` modules and `scripts/`, with tests                     |
| `ai-platform-environments` | Engineers by reviewed PR                         | `registry.json`, `global.tfvars.json`, `environments/{env}/platform.tfvars.json`  |
| `ai-platform-tenants`      | `submit.yml` (Portal API); break-glass by people | Caller workflows, `CODEOWNERS` and `README.md` only; `environments/` is read only |
| `ai-platform-deployments`  | `submit.yml` and release; break-glass by people  | Caller workflows, `CODEOWNERS` and `README.md` only; `environments/` is read only |

The guard hook denies edits under the tenants and deployments `environments/` folders, and any other file in those two repos outside the caller workflows, `CODEOWNERS` and `README.md`. Break-glass is a human procedure.

## Order

1. Change in `ai-platform-workflows` with tests; classify the release honestly (patch, minor, `feat!:` major) and list the callers it reaches.
2. Release, then callers (they take minors and patches through `@v1` automatically; a major needs their Dependabot PR).
3. Environment parameters after the infra release they need; state which environments the change dispatches.

## Divergence from the repo rules

Defra's CI standard requires Actions pinned to a full commit SHA; these repos pin vendor majors. New or changed `uses:` lines get the SHA with the tag as a comment; flag the untouched rest to the user as a decision, do not repin it unasked.

## Commands (workflows repo)

| Check                 | Command                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Unit and script tests | `npm test` (`tests/unit/`, `tests/integration/`); on Windows set `$env:AIP_TEST_BASH` to Git Bash         |
| Lint                  | `npm run lint`                                                                                            |
| Workflow lint         | `actionlint`                                                                                              |
| Shell                 | `shellcheck scripts/*.sh`                                                                                 |
| Environments          | `node ai-platform-infra/checks/bin/aip-checks.js canonical --file <file>`, then `aip-checks environments` |
| All gates             | `node <aip-quality-gates>/scripts/run-gates.mjs --repo <workflows> --full`                                |
