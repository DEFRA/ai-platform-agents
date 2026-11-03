---
name: aip-resume
description: 'Resume an AI Platform delivery run from its run folder in a fresh chat, keeping context small.'
argument-hint: 'Run folder name, or blank for the most recent'
agent: AIP Orchestrator
---

Resume the AIP run named in this message, or the most recent folder in `ai-platform-agents/.copilot-tracking/runs/` if none is named.

Orient as in `aip-run-control` section 8: read `state.md` and the last three `log.md` entries (`brief.md`, `plan.md` and the latest `review.md` and `release.md` rounds only when needed), then delegate one status-only call to the AIP Releaser for live PR state and working trees. Rebuild the todo list from `state.md` and `plan.md`, including parked inbox requests and any stage that needs `RESUME: yes`. Tell me in at most eight lines where the run stands and the next stage, then wait for my go-ahead.
