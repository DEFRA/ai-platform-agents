---
name: aip-validate
description: 'Validate that an AI Platform change does what was asked: trace every acceptance criterion in brief.md to code, tests and run evidence; run the change to prove it works (including accessibility and exploratory checks for pages); check it matches the design pack, decisions and Defra standards; find gaps, scope creep and missing docs. Use when verifying requirements, acceptance testing, functional checks or checking a build against its plan.'
license: OGL-UK-3.0
---

# Validation against the brief

The question is not "is the code good" but "did we build what was asked, and does it work". Independent of the Developer's claims: verify from code and runs.

## 1. Trace

For each AC in `brief.md`:

| AC  | Implemented at | Tested by                    | Run evidence      | Status                        |
| --- | -------------- | ---------------------------- | ----------------- | ----------------------------- |
| AC1 | `path:line`    | `file.test.js` > "test name" | gate log, command | met, partial, unmet, untested |

`untested` counts as unmet. Each task in `plan.md` should map to an AC; a change with no AC is scope creep: report it.

## 2. Prove it works

Pick the cheapest proof that exercises the real path:

- Backend: the route's `server.inject` tests pass and cover each AC branch; if not, call the route in a short Vitest run.
- Frontend: run locally (`npm run dev:mock-oidc` then `npm run dev`), then a time-boxed exploratory check with the browser tool (`aip-test-journey`) walking each AC, error and empty state, and the `aip-accessibility` scan plus keyboard and no-JavaScript checks. Screenshot only when it adds evidence.
- Journey: `npm run test:local` in `ai-platform-journey-tests` for pre-sign-in specs.
- Terraform: the tests assert the AC's values; say what a plan would show.
- Workflows: the integration test covering the path, or a dry run with fake CLIs.

If a proof needs credentials, a deployed environment or Azure, mark it `BLOCKED: needs {what}` rather than assuming.

## 3. Check conformance

- Matches the cited `design-*.md` sections and decisions; no unrecorded new direction.
- Pages follow `aip-gds-ui` and the flow in `plan.md` (`aip-user-flows`); Defra standards hold (`aip-defra-standards`).
- Contract matches across repos: methods, paths, payloads, error codes.
- Build to current design only: no legacy fallbacks, flags or dead code left.
- Docs: `remaining.md` to `implemented/` move, `implemented-features.md`, README for new env vars.

## 4. Gaps

Report each as a finding: missing AC behaviour, untested path, error state not handled, accessibility gap, contract mismatch, design drift, scope creep, missing docs. Severity per `aip-code-review`.
