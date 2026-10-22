---
name: aip-design
description: 'Record or change AI Platform design direction in ai-platform-discovery-docs before building: design pack pages (design-*.md), decisions (decisions.json D records), cloud designs (AR records), decision-history entries, diagrams and site tests, with options and evidence. Use when a requirement conflicts with or extends the confirmed design, a new decision is needed, or a design page must change.'
license: OGL-UK-3.0
---

# Design changes

The design pack in `ai-platform-discovery-docs` is the authority for direction. Build only against a recorded direction. This skill decides whether a design change is needed and how to make it; the repo's rules do the rest.

## Authorities (read, do not copy)

- `ai-platform-discovery-docs/.github/copilot-instructions.md`: "Every change: propagate, date and record", the eight steps every change follows.
- `ai-platform-discovery-docs/.github/instructions/design-pack.instructions.md`: page shape, status lines, diagrams, supersession, tests.
- `docs/decision-history.md` (newest entries first), `docs/design-pack-plan.md`, `src/data/decisions.json`, `src/data/cloud-designs.json`.

## Is a design change needed?

| Situation                                                         | Action                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Requirement fits a `Status: confirmed` section                    | No change; cite the anchor in `brief.md`                                                |
| Requirement fills a gap in a `Status: open` or `proposal` section | Propose wording; the user confirms it before build                                      |
| Requirement contradicts a confirmed section or decision           | Stop. Ask the user to choose: change direction (new decision) or change the requirement |
| Only built state changed                                          | Not a design change; the Docs agent records it after merge                              |

## Making the change

1. Branch in `ai-platform-discovery-docs` (`docs/{topic}`), never on top of someone's unmerged work.
2. Edit the one design page that owns the topic; keep its shape and `Status:` lines. Prefer tables.
3. Add or update the D or AR record if the decision is new or changed (bump `version`, add a dated `history` entry, advance `reviewedOn`).
4. Append a dated entry to `docs/decision-history.md` and update the "Direction in force" rows it decides.
5. Sweep for drift: search pages, data, `docs/` and `.github/` for the old wording; fix or mark superseded with a date and link. Remove what is fully superseded.
6. Set `ms.date` on every Markdown file changed.
7. Pin it in `test/site.test.js`: an `assertCopy` for the new direction and an `assert.doesNotMatch` for superseded wording. Update hard-coded counts where pages, sections or diagrams change.
8. Verify: `npm run lint` and `npm test`; `npm run check` when sections, anchors, diagrams or links change (it takes over 10 minutes; run it in a terminal and send the output to a file).

## Content rules

- British English, plain, no emojis; no real tenant, subscription, key or personal identifiers.
- Microsoft product behaviour cites a Learn page with a check date, or sits under `Status: open`.
- Never change application repositories from the discovery site.
- Keep it short: one table row or one sentence per change where possible.
