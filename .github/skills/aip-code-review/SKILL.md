---
name: aip-code-review
description: 'Independent code review of AI Platform changes: correctness, clean code (SOLID, DRY with the rule of three, thin routes, ports and adapters), Defra SDS and AICE standards, test quality, change impact, code smells, and SonarCloud issues and quality gate. Severity-graded, evidence-backed findings. Use when reviewing a diff, branch or PR, triaging Sonar issues, or checking code against standards.'
license: OGL-UK-3.0
---

# Code review

Find real problems. Every finding needs a location, evidence and an expected fix. Drop anything you cannot prove.

Conduct and severity follow the AICE `javascript-review-standards` skill. Judge design with `aip-clean-code`, tests with `aip-test-design`, standards with `aip-defra-standards`, and anything removed or reshaped with `aip-change-impact`. The repo's `copilot-instructions.md` and `pull-requests.instructions.md` say what review checks.

## Method

1. Scope: `git -C <repo> diff --stat <merge-base>` and `git -C <repo> status --short`; then the diff file by file.
2. Read enough surrounding code to judge each change: callers, tests, the pattern it copies.
3. Check each lens below; note findings with file and line.
4. Re-verify each finding before reporting: open the line, confirm the behaviour, and drop false positives.

## Lenses

| Lens        | Look for                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Correctness | Wrong conditions, unhandled promise or error paths, off-by-one, time zones, null and empty inputs, race conditions, missing awaits                                                                           |
| Design      | Business logic in routes or controllers; services touching another service's collection; adapters leaking rules; concrete adapter used instead of a port; duplicate helpers (DRY); dead or legacy code paths |
| Contract    | Frontend parsing messages instead of `code`; changed responses without tests; missing `Location` on 201; wrong method or status                                                                              |
| Standards   | Default exports, arrow functions outside callbacks, missing JSDoc on exports, relative imports across top-level `src/` folders, unpinned dependencies, discouraged libraries                                 |
| Tests       | ACs without tests; missing negative and edge cases; the bad-test smells in `aip-test-design`                                                                                                                 |
| Impact      | Breaking contract, persisted field without backfill, Terraform replace, workflow change that needs a major                                                                                                   |
| Smells      | Long functions (over about 40 lines), deep nesting, boolean parameters, magic values, comments restating code, catch-and-ignore                                                                              |
| Docs        | Plan, README and implemented-features not updated where behaviour changed                                                                                                                                    |

## Severity

| Severity | Meaning                                                                                          | Verdict effect   |
| -------- | ------------------------------------------------------------------------------------------------ | ---------------- |
| blocker  | Security hole, data loss, broken AC, failing gate                                                | CHANGES-REQUIRED |
| major    | Wrong behaviour in a real case, missing tests for an AC, standards breach a reviewer would block | CHANGES-REQUIRED |
| minor    | Maintainability or clarity; worth fixing now                                                     | Fix if cheap     |
| nit      | Preference; never blocks                                                                         | Optional         |

## SonarCloud

Projects: `DEFRA_ai-platform-frontend`, `DEFRA_ai-platform-backend-api`, `DEFRA_ai-platform-journey-tests` (organisation `defra`). Sonar analyses in CI, so it reports on a pushed branch or PR.

- MCP (read-only): `sonarqube` server tools for the quality gate, issues, hotspots and coverage of the PR.
- Web API fallback: `Invoke-RestMethod "https://sonarcloud.io/api/qualitygates/project_status?projectKey=<key>&pullRequest=<n>"` and `.../api/issues/search?componentKeys=<key>&pullRequest=<n>&resolved=false`; add `-Headers @{ Authorization = "Bearer $env:SONAR_TOKEN" }` if needed. Never print the token.
- Treat every new bug, vulnerability and hotspot as a finding; code smells by severity. Fix the cause; `NOSONAR` only with a written reason the user accepts.

## Finding format

`F{n} | severity | lens | path:line | finding | evidence | expected fix` in `review.md`.
