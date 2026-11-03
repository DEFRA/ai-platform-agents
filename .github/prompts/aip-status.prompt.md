---
name: aip-status
description: 'Show where an AI Platform run stands right now: state snapshot, live pull request state, working trees, parked requests and waits. Changes nothing except refreshing state.md.'
argument-hint: 'Run folder name, or blank for the most recent'
agent: AIP Orchestrator
---

Report the status of the AIP run named in this message, or the most recent folder in `ai-platform-agents/.copilot-tracking/runs/` if none is named. Read-only: no builds, reviews, requests, pushes or changes other than refreshing `state.md`.

Orient as in `aip-run-control` section 7: `state.md` and the last three `log.md` entries, then one status-only call to the AIP Releaser (`pr-state.mjs` per PR without `--wait`, and `git status --short` per repo). Answer in at most ten lines plus one table of PR groups with their `STATE`: what is done, what is in flight, what is waiting and until when, parked requests, and what I need to decide.
