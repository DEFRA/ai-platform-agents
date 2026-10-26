---
name: aip-deploy-operate
description: 'Release, deploy and operate AI Platform changes after merge: release-please releases, infra pins and autoPin, platform and tenants applies through ai-platform-deployments and -tenants, environment parameter changes, CDP image publish and deploy, run reports, failed-run triage, and read-only Azure checks. Every dispatch needs gate G3. Use when releasing, deploying, applying, dispatching, checking a run, smoke testing or troubleshooting an environment.'
license: OGL-UK-3.0
---

# Deploy and operate

GitOps by default: a merge applies. People approve; pipelines act. The authority is `ai-platform-infra/docs/gitops-contract.md`, the `ai-platform-workflows` README and `ai-platform-frontend/docs/plans/implemented/05-platform-and-gitops-pipeline.md`. CDP behaviour (config, secrets, redeploys, Portal test runs): `aip-cdp`.

## How each change reaches an environment

| Change                     | Path to running                                                                                                                          | Agent's part                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Frontend or backend        | Merge, `publish.yml` builds the image, an engineer deploys the version in the CDP Portal; config in `cdp-app-config` applies on redeploy | Report the version built; ask the user to deploy |
| `ai-platform-infra`        | Merge, release-please PR merged by `release-merge`, tag `vX.Y.Z`; `autoPin: true` environments pin and apply automatically               | Watch the release and pin PRs; report            |
| `ai-platform-workflows`    | Release moves `v1` (or a new major for breaking changes, taken by callers through Dependabot)                                            | Watch the release; list callers reached          |
| `ai-platform-environments` | Merge runs `validate-environments`, then dispatches that environment's platform apply                                                    | Say which environments it reaches before merge   |
| Platform pin               | `submit.yml` in `ai-platform-deployments` (release or person), validate, auto-merge, platform apply, then tenants apply                  | Dispatch only after G3                           |
| Team file                  | The Portal API dispatches `submit.yml` in `ai-platform-tenants`                                                                          | Never by hand                                    |

## Dispatching (G3 only)

1. Read the workflow's inputs first: `gh workflow view <file> -R DEFRA/<repo> --yaml`.
2. State the environment, the release before and after, and what the apply should change. Anything else in the plan is a bug: stop.
3. Dispatch: `gh workflow run <file> -R DEFRA/<repo> -f <input>=<value>` (the guard hook asks the user to confirm).
4. Retry a failed apply with a fresh dispatch of `apply.yml`, never `gh run rerun`. `allow_destroy` and `force_unlock` are engineer-only break-glass inputs: never set them.

## Watching runs

- `gh run list -R DEFRA/<repo> --workflow <file> --limit 5`; `gh run view <id> -R DEFRA/<repo> --log-failed` for failures only.
- `gh --jq` with pipes breaks in PowerShell: use `--json` and `ConvertFrom-Json`.
- Read the run report artifact and the plan-guard output; compare with the expected change.
- Write status to `release.md`: run link, result, what applied.

## Operating checks (read-only)

- Azure: `az ... show` and `list` only, and only in the environment's resource group; never change Azure by hand (writes go through IaC; the guard hook asks before any `az` write). `az --query` with brackets breaks in PowerShell: filter with `ConvertFrom-Json`.
- Portal and API: smoke the journey with `ai-platform-journey-tests` (`PROFILE=smoke`) against the environment when the user asks; CDP logs and metrics are read in the CDP Portal by a person.
- Report state as built, released, pinned, applied and verified separately. Never claim deployed without evidence.

## Never

Merge a PR, edit state files, re-run a failed apply, touch break-glass inputs, apply Terraform locally, or change a resource outside the plan.
