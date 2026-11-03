---
name: aip-start
description: 'Start a new AI Platform delivery run with the Orchestrator: give a requirement, or link a plan item, design page, spec or Plan-mode plan.'
argument-hint: 'Requirement, or a link to a plan item (B##), design page, spec or Plan-mode plan'
agent: AIP Orchestrator
---

Start a new AIP run for the request in this message.

- If the message has no requirement and no link, ask me for one: a new requirement, a plan item in `ai-platform-frontend/docs/plans/remaining.md`, a design page or decision in `ai-platform-discovery-docs`, a spec file, or a Copilot Plan-mode plan.
- Run intake, ask the questions that change the outcome, then delegate planning.
