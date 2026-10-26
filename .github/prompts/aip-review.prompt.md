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
