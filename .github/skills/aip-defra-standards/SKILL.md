---
name: aip-defra-standards
description: 'Defra software development standards (SDS) as the source of truth for AI Platform work, with links, the checkable MUSTs (coverage, SonarQube Cloud, exact pins, npmrc, neostandard, Hapi, no front-end frameworks, Actions SHA pins, dependency review, GHAS, ECS logging without PII, OWASP, QA acceptance criteria, README, licence) and where AIP repos currently diverge. Use when checking standards compliance, reviewing, planning, or when a repo rule and Defra standard disagree.'
license: OGL-UK-3.0
---

# Defra standards

Source of truth: [Defra software development standards](https://github.com/DEFRA/software-development-standards) (`docs/standards`, `docs/processes`, `docs/guides`). When a repo rule and SDS disagree, follow SDS and flag the conflict; never silently pick one. Re-check the source before quoting a rule older than a month.

## Checkable MUSTs

| Area         | Rule                                                                                                                                                                                   | SDS file                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Branching    | Work on branches; `main` always releasable and protected (required checks, approving review)                                                                                           | `common_coding_standards.md`, `version_control_standards.md` |
| Review       | Another developer reviews every change                                                                                                                                                 | `common_coding_standards.md`                                 |
| Coverage     | Unit coverage at least 90 percent and the total never decreases                                                                                                                        | `common_coding_standards.md`                                 |
| Quality gate | SonarQube Cloud in CI with coverage; Defra standard quality gate met                                                                                                                   | `continuous_integration.md`                                  |
| Simplicity   | Rule of three before abstracting; no speculative reuse; comments say why; no commented-out code                                                                                        | `common_coding_standards.md`                                 |
| JavaScript   | Vanilla JS (TypeScript needs an exception); neostandard unmodified; no React, Vue or Angular                                                                                           | `javascript_standards.md`                                    |
| Node         | Hapi on its current major; Active LTS; ES modules; no session state on the server                                                                                                      | `node_standards.md`                                          |
| Dependencies | npm with lock file, `npm ci` in CI, exact versions; `.npmrc` `save-exact`, `ignore-scripts`, `min-release-age`; vet new packages                                                       | `node_standards.md`, `guides/choosing_packages.md`           |
| CI security  | Pin every Action to a full commit SHA (tag as a comment); `dependency-review-action` on PRs; resolve Security tab alerts                                                               | `continuous_integration.md`, `security_standards.md`         |
| Scanning     | GitHub Advanced Security first (code, secret, Dependabot); Snyk only where it adds value                                                                                               | `security_standards.md`                                      |
| Security     | OWASP Secure Coding Practices                                                                                                                                                          | `security_standards.md`                                      |
| Logging      | Structured ECS; no PII or secrets (names, emails, phone, NI, tokens, keys)                                                                                                             | `logging_standards.md`                                       |
| QA           | Default ACs: matches design, Design System, WCAG AA, server-side validation, under 1 s responses, no regression; negative scenarios as important as positive; works without JS and CSS | `quality_assurance_standards.md`                             |
| PRs, commits | Focused PR (AIP reads this as one purpose, not a size limit); subject under 50 characters, imperative, explains what and why                                                           | `processes/pull_requests.md`                                 |
| Repo         | README (purpose, prerequisites, setup, run, test, branching, contributing, licence); OGL v3 licence                                                                                    | `readme_standards.md`                                        |
| Copilot      | Agents single-role with boundaries; skills lean and linked; never weaken a test to pass                                                                                                | `guides/github_copilot.md`                                   |

## Where AIP diverges today (flag, do not fix silently)

- Actions use tags (`@v7`, `@v1`), not SHAs. New or changed `uses:` lines pin by SHA with a tag comment; the internal `ai-platform-workflows@v1` model needs a recorded exception or migration.
- Commits use conventional prefixes for release-please. Keep the prefix, then follow SDS: imperative, short, body says what and why.
- Snyk is used beside GHAS: GHAS findings come first.
- The SDS QA standard says WCAG 2.1; GOV.UK requires 2.2 AA. Build to 2.2.
- No repo enforces the 90 percent threshold in `vitest.config.js`; the Reviewer checks it.

`run-gates.mjs` checks exact pins, Action SHA pins and open GHAS alerts.
