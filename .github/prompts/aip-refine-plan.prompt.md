---
name: aip-refine-plan
description: 'Turn a Copilot Plan-mode plan from this chat (or session memory) into an AIP brief and plan with acceptance criteria, design checks and a repo-by-repo test strategy.'
argument-hint: 'Optional: run name or extra context'
agent: AIP Planner
---

Refine the Copilot Plan-mode plan above in this chat into an AIP run. If there is no plan in the chat, read `/memories/session/plan.md`; if that is missing too, ask me for the plan or a requirement.

Follow the `aip-plan` skill's "Refining a Copilot Plan-mode plan" steps: keep its research, verify every assumption against built state and the design pack, map steps to acceptance criteria, add the platform steps it missed, and ask me the questions that change the outcome. Write `brief.md` and `plan.md`, then summarise what changed from the Plan-mode draft in at most eight lines.
