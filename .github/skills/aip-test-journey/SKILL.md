---
name: aip-test-journey
description: 'Write and run AI Platform journey tests (WebdriverIO in ai-platform-journey-tests) and evidence-driven exploratory checks with the browser tool: page objects, pre-signin and post-signin suites, local runs against the frontend, CDP Portal runs, and a time-boxed exploratory session that records what was tried and seen. Use when adding a journey, changing a flow end to end, or proving a page works in a real browser.'
license: OGL-UK-3.0
---

# Journey and exploratory tests

Repo rules: `ai-platform-journey-tests/.github/instructions/journey-tests.instructions.md`. CDP runs: `aip-cdp`.

## Journey tests (WDIO)

- One spec per journey in `test/specs/pre-signin/` or `test/specs/post-signin/`; one page object per page in `test/page-objects/` extending `Page`.
- Select by what a person perceives (heading, label, link or button text, stable `data-testid`); assert title, heading, URL and error summary with WDIO's waiting `expect`.
- Cover the happy path and the most important unhappy path per journey; leave rules to unit tests.
- Run: start the frontend, then `npm run test:local`. Post-signin specs need `.env.local` credentials: ask a person to run them and paste the result line.
- In CDP: the Portal runs the latest build with `PROFILE=smoke` (pre-signin) or `full`.

## Exploratory check (browser tool), time-boxed

Use for a new or changed page before review, and by the Reviewer to prove ACs.

1. Charter: one line, for example "Request a team credential as an Admin and as a Member".
2. Budget: about 30 meaningful actions; at 20, stop and review what is left.
3. Loop: observe, expect, act, compare. Try the happy path, then errors, back and change links, refresh mid-journey, keyboard only, 320 px width, JavaScript off.
4. Safety: local or test environments only; synthetic data; never enter real credentials or personal data; never type passwords for the person.
5. Evidence: a table in `review.md`:

| #   | Action | Expected | Observed | Result |
| --- | ------ | -------- | -------- | ------ |

Screenshots only where they prove a defect; save them in the run folder.
