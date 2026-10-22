---
name: aip-quality-gates
description: "Run an AI Platform repo's local quality gates with one command and a compact result: exact dependency pins, format, lint, tests, coverage (lines and functions 90, branches 85, changed files too), GitHub Advanced Security alerts, npm audit, Snyk, gitleaks secrets, Actions SHA pins, Terraform fmt, validate and test, tflint, Checkov, actionlint and shellcheck. Use before review, before a PR, after fixes, or to check coverage or security."
license: OGL-UK-3.0
---

# Quality gates

One script runs what CI runs, plus the security scans, and prints at most a screen of output. Full logs go to files so the agent's context stays small.

```powershell
node <this skill>/scripts/run-gates.mjs --repo <repo path> --quick
node <this skill>/scripts/run-gates.mjs --repo <repo path> --full --out <run folder>/gates
```

`<this skill>` is `ai-platform-agents/.github/skills/aip-quality-gates`. Add `--base <ref>` when the base is not `origin/main` (the script diffs from the merge base), or `--dry-run` to list the planned commands without running them.

| Mode    | Runs                                                                                                                                                                                                                                                                                          | Who                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `quick` | exact dependency pins, `format:check`, `lint`, tests (Unix env prefixes handled on Windows), `checks/` in infra, Terraform fmt, validate and tests                                                                                                                                            | Developer and Platform Engineer after each task |
| `full`  | quick, then open GHAS alerts (code, Dependabot, secret; warning), `security-audit` (and `checks/` audit in infra), `npm audit --audit-level=high` (warning), Snyk SCA and Code, gitleaks on the diff, Actions SHA pins (warning), tflint, Checkov (warning), Snyk IaC, actionlint, shellcheck | Reviewer; builders before handover              |

Coverage comes from `coverage/lcov.info` (or a root `lcov.info`) written during the run. Targets: lines and functions 90 (Defra), branches 85 (as in `ai-platform-workflows`). Totals and every changed file below target count as a failure.

## Reading the result

```text
GATES ai-platform-backend-api (full)
PASS format 9s
FAIL test 61s  log: .../gates/ai-platform-backend-api-test.log
     | {last 25 lines}
SKIP snyk-sca  snyk not installed
COVERAGE repo lines 94.2 | branches 84.1 | functions 96  (below target: branches 84.1 < 85)
  changed file below target: src/services/x.js lines 75 < 90
RESULT FAIL (1 failed, 0 warnings, 1 skipped, 2 coverage misses)
```

- Read the tail first; open the log only for the failing step, and only the part you need.
- `SKIP` is not a pass. Report every skipped scan with its reason; the Reviewer marks the verdict `BLOCKED` when a required scan cannot run and the user has not waived it.
- `WARN` steps are advisory because the repos are not yet compliant (open GHAS alerts, high-severity audit, tag-pinned Actions, Checkov soft-fail as in CI); record new ones caused by the change as findings.

## Tools

Defra standards prefer GitHub Advanced Security over Snyk: GHAS results come first; Snyk adds SAST and IaC depth.

| Tool                                      | Setup (once, by the person)                                  | Notes                                                                |
| ----------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| GitHub CLI                                | `gh auth login`                                              | GHAS alert counts need security read access; no access shows as skip |
| Snyk CLI                                  | `npm install --global snyk` then `snyk auth` (browser OAuth) | Exit 1 = issues (fail); 2 or 3 = could not run (skip)                |
| gitleaks                                  | Install the release binary; on PATH                          | Runs with `--redact`; never print a secret                           |
| Checkov                                   | `pipx install checkov`                                       | Advisory until findings are triaged (infra plan)                     |
| tflint, actionlint, shellcheck, terraform | On PATH                                                      | Same versions as CI where possible                                   |

SonarCloud is not local: read the quality gate and issues through the `sonarqube` MCP server (read-only) or the Web API, see the `aip-code-review` skill.

## Rules

- Never weaken a gate to pass: no disabled rules, skipped tests, lowered thresholds or `--no-verify`.
- Fix the cause, re-run quick for the repo, then full before handover.
- Discovery docs: the script runs `lint` and `test`; run `npm run check` yourself when sections, anchors, diagrams or links change (over 10 minutes; send output to a file).
- Journey tests need a running frontend, so the script reports them as skipped; see `aip-test-journey`. Accessibility scans: `aip-accessibility`.
