---
description: 'Use when writing AIP run files (brief.md, plan.md, log.md, review.md, release.md) in a run folder.'
applyTo: '.copilot-tracking/runs/**'
---

# Run files

- Follow the templates in [run-files.md](../skills/aip-handoff/references/run-files.md); keep each file to what the next agent needs.
- Append to `log.md`, never rewrite it. Newest `review.md` round goes on top.
- Link sources and code as `path:line`; never paste large code, logs or documents.
- No secrets, tokens, `.env` values, personal data or full Azure resource ids.
