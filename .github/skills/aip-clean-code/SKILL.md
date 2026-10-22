---
name: aip-clean-code
description: "Clean, SOLID and DRY code for AI Platform JavaScript and Terraform, balanced with Defra's rule of three: naming, small functions, one responsibility, ports and adapters, no duplication without a reason, no speculative abstraction, no dead code, safe refactoring with tests. Includes good and bad examples for this stack. Use when writing, refactoring or reviewing code quality, or when removing legacy code."
license: OGL-UK-3.0
---

# Clean code

Style rules live in the AICE `javascript-style-guide` and each repo's instructions. This skill is about design quality.

## Principles, applied here

| Principle             | In AIP                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Single responsibility | Route validates and delegates; service owns one area; adapter owns one integration; controller shapes one view model |
| Open/closed           | Add a route, service, adapter, module or component; do not special-case a shared helper for one caller               |
| Liskov                | Every adapter passes its port's shared contract test (`*-contract.js`) unchanged                                     |
| Interface segregation | Ports expose only what callers use; helper modules export only what is needed                                        |
| Dependency inversion  | Services take ports (injected or registry defaults), never a concrete Azure or GitHub client                         |
| DRY                   | One source for each rule or value; duplicate once, extract on the third use (Defra rule of three)                    |
| YAGNI                 | No options, flags or layers for a case nobody has asked for                                                          |

## Good and bad

| Bad                                                   | Good                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Route handler queries MongoDB and builds the response | Route calls `credentialService.issue()`; service owns the logic           |
| `getData(x, true, false)`                             | `listCredentials({ includeExpired: true })`                               |
| `catch (e) {}` or `catch (e) { return null }`         | Map to a `Boom` error with a stable `code`; log `{ err }` once            |
| Same validation copied into three routes              | One Joi schema exported and reused                                        |
| Generic `utils.js` growing every sprint               | Named module per concern: `team-slug.js`, `mongo-lock.js`                 |
| `if (env === 'prod')` scattered in code               | Config value read once through convict                                    |
| Old and new code paths kept "for safety"              | Current design only; delete the old path and its tests in the same change |
| Comment explaining what the next line does            | A name that says it; comments only for why                                |
| Terraform resource names as literals                  | `modules/naming` outputs                                                  |

## Size and shape

Functions do one thing and fit on a screen (about 40 lines); nesting at most three levels; parameters at most three (use an options object). When a file grows too big, split it per `aip-architecture`.

## Refactoring safely

1. Tests green first; add characterisation tests where behaviour is unpinned.
2. Small steps, tests after each; no behaviour change mixed into a refactor commit.
3. Remove superseded code, config, tests and docs in the same change. If anything persisted or external depends on it, check `aip-change-impact` first.
