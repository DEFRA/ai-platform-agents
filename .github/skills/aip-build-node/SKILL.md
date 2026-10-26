---
name: aip-build-node
description: 'Build AI Platform Node.js changes: ai-platform-frontend (Hapi, Nunjucks, GOV.UK Frontend, Vite) and ai-platform-backend-api (Hapi JSON API, MongoDB, ports and adapters). Where code goes, cross-repo order, test-first loop and Windows commands. Use when implementing routes, pages, components, services, adapters, api-client calls or backend errors.'
license: OGL-UK-3.0
---

# Build: frontend and backend

Each repo's `.github/copilot-instructions.md` and `.github/instructions/*.md` are the rules. Read them before the first edit in a repo. Use the AICE skills for JavaScript: `javascript-style-guide`, `javascript-testing-standards`, and `javascript-design-language` for any page. Scaffold new pages with the `new-route` skill. Design quality: `aip-clean-code`. Pages: `aip-gds-ui`, `aip-user-flows`, `aip-accessibility`. Tests: `aip-test-design`, `aip-test-node`. Runtime: `aip-cdp`.

## Where things go

| Concern          | Frontend                                                                                                               | Backend                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Route            | `src/server/routes/<name>/{index.js,controller.js,index.njk}`; register in `src/server/plugins/router.js`              | `src/routes/<resource>.js`: Joi validation, one service call, map result                                                |
| Logic            | View-model shaping in the controller; no business rules                                                                | `src/services/*.js`; no HTTP handling                                                                                   |
| External calls   | Only through `src/server/common/helpers/api-client.js`                                                                 | Adapters in `src/adapters/` behind a port with a `-registry.js`                                                         |
| Errors           | Map the API's `code` (never its message), `govuk-errors.js` for forms                                                  | `boom-with-code.js`: a stable `code` on every error                                                                     |
| Shared UI        | `src/server/common/components/<name>/{macro,template}.njk` + `template.test.js`                                        | -                                                                                                                       |
| Config           | `src/config/config.js` (convict); never `process.env` elsewhere                                                        | `src/config.js` (convict)                                                                                               |
| Security         | CSP in `plugins/content-security-policy.js` (extend allow-lists), crumb on POST, session in `plugins/session-cache.js` | Joi `.unknown(false)` on payload, query and params; `idempotency-key` on creates; `mongo-lock.js` for multi-step writes |
| Persisted fields | -                                                                                                                      | Readers tolerate absence; backfill in `src/common/backfills/registry.js` when queried                                   |

Boundaries, contract versioning and reliability rules: `aip-architecture`. Cross-repo order: backend route, service and `server.inject` tests for each error `code`; then the frontend `api-client.js` call, code-to-message mapping and page tests.

## Test-first loop

1. Find the closest existing pattern (an Explore subagent, "quick").
2. Write the failing test next to the file under test (`<name>.test.js`).
3. Implement the smallest change that passes; refactor; keep functions small and named.
4. Run targeted tests, then the repo's quick gates.

## Commands (PowerShell; `npm test` uses Unix env syntax)

| Task          | Frontend                                                                                     | Backend                                                                    |
| ------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| One test file | `$env:AWS_EMF_ENVIRONMENT='Local'; $env:TZ='UTC'; npx vitest run <path>`                     | `$env:TZ='UTC'; npx vitest run <path>`                                     |
| Quick gates   | `node <aip-quality-gates>/scripts/run-gates.mjs --repo <repo> --quick`                       | same                                                                       |
| Run locally   | Redis from the frontend compose file; `npm run dev:mock-oidc` then `npm run dev` (port 3000) | `docker compose --env-file <empty file> up -d mongodb`, then `npm run dev` |
| Format        | `npm run format`                                                                             | `npm run format`                                                           |

Use `npm --prefix <repo>` or `git -C <repo>`: the terminal may start in another workspace folder (`npm --prefix X exec vitest` needs `--root X`). A test that times out in a full run but passes alone is load, not a defect; say so.

## Done when

- Every task AC has a passing test; a bug fix has a regression test that failed first.
- Quick gates pass in each touched repo; no lint disables, skipped tests or lowered thresholds.
- JSDoc on new exports; named exports only; function declarations; `#/*` imports across top-level `src/` folders (frontend).
- No new dependency unless the plan approved it (exact-pinned, no lodash, moment, axios or frontend frameworks).
