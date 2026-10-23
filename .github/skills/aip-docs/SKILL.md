---
name: aip-docs
description: "Keep AI Platform documentation true after a change: docs/plans (remaining.md to implemented/), implemented-features.md, READMEs, repo instructions, and the discovery site's built state (build-stories status, decision-history, ms.date, site tests) as a separate PR. Concise, linked, dated. Use when updating docs, plans, README, implemented features or recording built state."
license: OGL-UK-3.0
---

# Documentation

Docs are short, accurate and consolidated: link to the authority, update the existing section, never append a second copy. British English, plain, no emojis, dates as "22 Oct 2026".

## What a change needs

| Change                                   | Update                                                                                                                                                                                                                                  | When                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Plan record (every work PR)              | The entry named in `plan.md` "Docs and record"; infra or workflow work with no frontend PR uses the owning repo's plan file                                                                                                             | Same PR as the code                         |
| Plan item built                          | Move it from `ai-platform-frontend/docs/plans/remaining.md` to the matching `docs/plans/implemented/NN-*.md` with a dated line; update `docs/plans/README.md` tables and `implemented/implemented-features.md` (row and "Last updated") | Same PR as the code                         |
| Item deferred                            | Keep in `remaining.md`, marked "deferred, not removed"                                                                                                                                                                                  | Same PR                                     |
| UI flow changed (route added or renamed) | `ai-platform-frontend/docs/flat-design-updates/v3/build-plan.md`                                                                                                                                                                        | Same PR                                     |
| New env var, script or setup step        | That repo's `README.md`                                                                                                                                                                                                                 | Same PR                                     |
| New convention or rule                   | That repo's `.github/copilot-instructions.md` or the matching instruction file                                                                                                                                                          | Same PR                                     |
| Built state changed                      | `ai-platform-discovery-docs/src/content/build-stories.md#status` and any dated "Built by" or "State on" note on a design page                                                                                                           | One docs PR per run, after merge or release |

The end-of-run docs PR also carries any design change written at planning and, when no work PR touched the frontend, the `docs/plans/` update. The rules behind this table: `ai-platform-frontend/.github/instructions/route-plans.instructions.md` and `implemented-features.instructions.md`. Repoint every inbound link when moving a section.

## End-of-run docs PR (discovery site)

Follow that repo's "Every change: propagate, date and record" steps:

1. Record built state only, never a new direction; cite the version and date; say "in an open pull request" for anything unmerged. Built is not accepted, and nothing is deployed without evidence.
2. Sweep for contradicted statements; set `ms.date` on each changed Markdown file.
3. Append to `docs/decision-history.md` (say whether decision records changed) and add a "Delivered on" note to `docs/design-pack-plan.md` when design work lands.
4. Pin copy in `test/site.test.js` (`assertCopy`, and `assert.doesNotMatch` for superseded wording; avoid wording that also matches page boilerplate).
5. Run `npm run lint` and `npm test`; `npm run check` when sections, anchors, diagrams or links change (over 10 minutes; output to a file).

If nothing needs changing, say "build status checked, no change".

## Format

Run Prettier on every Markdown file you touch (`npx prettier --write <files>` in that repo); CI fails unformatted Markdown. Check new files are not empty and stage them with `git add <file>`.
