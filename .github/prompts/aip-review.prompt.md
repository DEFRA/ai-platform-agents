---
name: aip-review
description: 'Run an independent AIP review of the current changes: full gates, coverage, security scans, SonarCloud, code review and acceptance criteria.'
argument-hint: 'Repos to review and the requirement or acceptance criteria (or a run folder)'
agent: AIP Reviewer
---

Review the changes named in this message in a fresh context.

- If a run folder is given, use its `brief.md` acceptance criteria. Otherwise create `ai-platform-agents/.copilot-tracking/runs/{yyyy-mm-dd}-review-{slug}/`, write the criteria I gave (or the PR description) into `brief.md`, and ask me if there are none.
- Default scope: every workspace repo with changes against `origin/main`.
- Report the verdict, findings by severity and skipped scans in at most 15 lines; details in `review.md`.
- For every repo with an open PR, check its Copilot threads with `pr-state.mjs` (no `--wait`) and report them in the `review.md` round using the template in `run-files.md` ("Copilot threads"):
  - **Within the cap** (Copilot reviews 1 to 3): no thread may be left unresolved. Each unresolved thread is a finding owned by the builder, and the verdict is `CHANGES-REQUIRED` until every one is fixed and resolved, or answered with a reason and resolved.
  - **Cap reached** (review 4 onwards): run the check once more. Anything still unresolved is not a finding and does not block: list it (thread id, path and line, one line) under "For the human reviewer" and leave it open.
  - A review pending (`REVIEW-PENDING`) is never "nothing unresolved": report it as pending.
