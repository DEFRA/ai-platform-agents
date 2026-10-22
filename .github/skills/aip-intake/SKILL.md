---
name: aip-intake
description: "Turn a request into a challenged AI Platform brief: find the source (new requirement, plan item B##, discovery design page, spec, Copilot Plan-mode output), state the user need, size it, ask the questions that change the outcome with trade-offs, and write brief.md with Given/When/Then acceptance criteria including Defra's default criteria. Use when starting work, clarifying a requirement, scoping, or challenging ambiguity."
license: OGL-UK-3.0
---

# Requirement intake

Nothing starts without a user-provided requirement or a link to an existing plan, design or spec. If there is neither, ask for one.

## 1. Find and read the source

| Source               | Where                                                                        | Authority for                 |
| -------------------- | ---------------------------------------------------------------------------- | ----------------------------- |
| Plan item (B##, R##) | `ai-platform-frontend/docs/plans/remaining.md`                               | What is left, blockers        |
| Built state          | `ai-platform-frontend/docs/plans/implemented/` and `implemented-features.md` | What exists today             |
| Acceptance criteria  | `ai-platform-discovery-docs/src/content/build-stories.md`                    | Story ACs (B01 to B27, later) |
| Design direction     | `ai-platform-discovery-docs/src/content/design-*.md`, `decisions.md`         | How it should work            |
| Latest direction     | `ai-platform-discovery-docs/docs/decision-history.md` (newest entries)       | What changed and when         |
| Cross-repo plans     | `ai-platform-discovery-docs/docs/*-plan.md`                                  | IaC, promotion, schema plans  |
| Copilot Plan mode    | The chat, or `/memories/session/plan.md`                                     | A draft only; verify it       |

The discovery checkout may sit on a feature branch with local work. Read `origin/main` with `git show origin/main:<path>` rather than switching branch.

## 2. Size it

- **S**: one repo, no design change, no new persisted field, no identity, infra or security surface.
- **M**: one or two repos, a contract change, or a new persisted field.
- **L**: cross-repo, design or decision change, Terraform, identity, GitOps, or anything reaching Azure.

Size sets depth: S gets a five-line brief; L gets design checks and a rollout section.

## 3. Ask before you build

Ask only questions whose answer changes scope, design, security, tests or rollout. At most five at a time, each with options, a one-line trade-off and a recommendation (`aip-evidence`). Use [question-bank.md](./references/question-bank.md). Research the answer yourself first when the repo, the design pack, Defra standards or a vendor doc can settle it.

Challenge, do not accept:

- Vague verbs: "support", "handle", "manage", "improve", "secure". Ask for the observable result.
- Hidden scope: "and also", "for now", "later we can". Split or record as a non-goal.
- Conflicts with a confirmed design or decision. Name the page and anchor; the design wins until a decision changes it.
- Missing failure behaviour: what the person sees on error, timeout, no permission, empty state.
- Security and data: personal data, secrets, new permissions, public exposure.
- Built already? Check implemented plans first; it may be a refactor, not a feature.

## 4. Write brief.md

Use the template in [run-files.md](../aip-handoff/references/run-files.md). Rules:

- Every AC is testable and traceable to a source link or a dated user answer.
- Start from the user need: "As a {role, tier}, I need {outcome} so that {reason}" (`aip-user-flows` for journeys).
- Include error, permission and accessibility ACs, not only the happy path.
- For anything a person sees, add Defra's default criteria ([QA standards](https://github.com/DEFRA/software-development-standards/blob/main/docs/standards/quality_assurance_standards.md)): matches the design, uses the Design System, WCAG 2.2 AA, server-side validation, works without JavaScript, responses under 1 second, no regression.
- Record whether the change touches anything live (`aip-change-impact`).
- Non-goals are explicit.
- Record each user answer verbatim with the date.
- At most one page.
