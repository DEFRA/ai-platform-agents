# ai-platform-agents

The AI Platform delivery framework: Copilot agents, skills, prompts and guard hooks across the `ai-platform-*` repositories. Start with `/aip-start` or **AIP Orchestrator**. Overview and setup: [README](../README.md).

## Principles

- **Fast, in the right direction.** Smallest change that meets the user need; decide quickly on evidence; ask only questions that change the outcome; short outputs.
- **Evidence or it did not happen.** Every done, pass or "best practice" claim cites a command result, `path:line`, test or dated source ([aip-evidence](skills/aip-evidence/SKILL.md)).
- **Defra standards are the source of truth** ([aip-defra-standards](skills/aip-defra-standards/SKILL.md)); flag any repo rule that disagrees.

## Authoring rules

- **Agents are thin:** role, scope, boundaries, steps; at most about 60 lines of body. Depth lives in `aip-*` skills.
- **Skills are focused:** one topic, `name` equals the folder, description says what and "Use when" with trigger words, under 200 lines, detail in `references/` or `scripts/`, `license: OGL-UK-3.0`.
- **Link, never copy** a repo's rules; file-scoped instructions (`applyTo`) live in the repo whose files they govern.
- **Least privilege by hook, not by crippling tools:** agents get broad tools (web, browser, MCP); `scripts/aip-guard.mjs` enforces dangerous-command rules and each role's edit paths.
- **Shared contract:** run folder, delegation prompt, return contract and routing in [aip-handoff](skills/aip-handoff/SKILL.md).
- **Models** are picker names with a fallback, for example `["Claude Opus 5.5 (copilot)", "Claude Opus 5 (copilot)"]`.
- British English, concise, no emojis, no secrets or real tenant, subscription or personal identifiers (this repo is public).

## Checks

- `npm run format`, then `npm run format:check`, `npm run validate` and `npm test` pass before every commit.
- A change to a script ships with a test that fails without it.
- Branch, PR, Copilot review (capped at three reviews per PR, see `aip-pull-request`), then a human reviewer; never `--no-verify`.
