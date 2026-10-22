---
name: aip-resume
description: 'Resume an AI Platform delivery run from its run folder in a fresh chat, keeping context small.'
argument-hint: 'Run folder name, or blank for the most recent'
agent: AIP Orchestrator
---

Resume the AIP run named in this message, or the most recent folder in `ai-platform-agents/.copilot-tracking/runs/` if none is named.

Read only `brief.md`, `plan.md`, the latest `review.md` and `release.md` rounds and the last three `log.md` entries. Rebuild the todo list from `plan.md`, tell me in at most eight lines where the run stands and the next stage, then wait for my go-ahead.
