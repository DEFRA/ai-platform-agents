---
name: aip-test-node
description: 'Write AI Platform Node.js tests with Vitest: backend route integration tests with server.inject and vitest-mongodb, service and adapter tests with nock and port contract tests, frontend controller and Nunjucks component tests, plus the minimum scenarios every route and page must cover. Includes Windows commands. Use when writing or fixing frontend or backend unit and integration tests.'
license: OGL-UK-3.0
---

# Node tests (Vitest)

Repo rules first: each repo's `.github/instructions/testing.instructions.md`. Tests sit beside the code as `<name>.test.js`; Vitest globals; what to test comes from `aip-test-design`.

## Patterns

| Layer               | How                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend route       | Start the server once per file, `server.inject({ method, url, headers, payload })`, real in-memory MongoDB via `vitest-mongodb` (see any `src/routes/*.test.js`)                                             |
| Backend service     | Call the service with a real collection; inject port fakes only for external systems                                                                                                                         |
| Adapter             | `nock` the HTTP API; run the shared contract (`credential-issuer-contract.js`, `tenant-orchestrator-contract.js`) against it                                                                                 |
| Frontend controller | `server.inject`; backend responses stubbed with `vitest-fetch-mock` (`fetchMock.mockResponseOnce`); sign-in via `vi.mock('#/server/common/helpers/oidc-client.js')` (see `routes/models/controller.test.js`) |
| Component           | `template.test.js` with `test-helpers/component-helpers.js`                                                                                                                                                  |

Stub at the network edge (`fetchMock`, `nock`), not inside the code under test. `vi.mock()` only for this repo's boundary modules such as the OIDC client.

## Minimum scenarios

**Backend route:** success with body and status (201 plus `Location` for creates); 400 for invalid and unknown keys; 401 without identity; 403 wrong role; 404 unknown id; 409 conflict and idempotent replay with the same `idempotency-key`; upstream failure maps to a stable `code`; no secret or personal data in the response or log.

**Frontend page:** GET renders the heading and title; POST without crumb is refused; POST invalid shows the error summary, inline errors and keeps values; POST valid redirects; each API `code` maps to its message; signed-out access redirects to sign-in.

## Gotchas

- Mongo `_id` from `server.inject` results are `ObjectId`s: compare with `.toString()`.
- Windows: `npm test` uses Unix env syntax. Use `run-gates.mjs`, or `$env:TZ='UTC'; npx vitest run <path>` (frontend also `$env:AWS_EMF_ENVIRONMENT='Local'`).
- A test that times out only in a full run under load: re-run it alone before calling it a defect; record both results.
