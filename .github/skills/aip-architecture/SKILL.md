---
name: aip-architecture
description: 'AI Platform system boundaries and contracts: what belongs in the frontend, backend routes, services and adapters, GitHub Actions orchestration and Terraform; API contract and versioning; reliability (timeouts, retries, idempotency, locks, fail closed); when to split a module or propose a new service. Use when planning or reviewing work that crosses repos or layers, adding an endpoint, adapter or external call, changing a contract, or when a module grows too big.'
license: OGL-UK-3.0
---

# Architecture: boundaries, contracts, reliability

Authorities, linked not copied: each app repo's `.github/copilot-instructions.md` (layers, REST, error `code`, `Idempotency-Key`, `keyHint`), backend `schema-changes.instructions.md`, `ai-platform-infra/docs/gitops-contract.md`, the design pack. This skill adds where a change belongs, how a contract evolves, how calls fail and when to split.

## Boundaries

| Layer                                 | Owns                                                                                                                                         | Never                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Frontend                              | Pages, view models, session, sign-in, mapping API `code` to words                                                                            | Business rules, MongoDB, Azure or GitHub calls; `fetch` outside `api-client.js` |
| Backend `src/routes/`                 | Joi validation, `x-user-id`, one service call, status and `Location`                                                                         | Logic or DB access                                                              |
| Backend `src/services/`               | Business rules, orchestration, locks, persistence                                                                                            | HTTP shapes; concrete adapters (take ports from a `-registry.js`)               |
| Backend `src/adapters/`               | One external system behind a port (`credential-vault.js`, catalogue source, issuer, tenant orchestrator), contract test shared with the mock | Business rules                                                                  |
| `ai-platform-workflows`, `submit.yml` | Applying desired state: validate, plan, apply, report                                                                                        | Business decisions; logic inline in YAML                                        |
| `ai-platform-infra`                   | Azure resources from team files and parameters                                                                                               | Secrets; APIM subscriptions (the backend owns them)                             |
| `ai-platform-tenants`, `-deployments` | Desired state written by machines                                                                                                            | Hand edits                                                                      |

A rule needed by two layers lives in the lower one and is exposed; the upper one consumes it.

## Contract and versioning

- Public routes are `/v1/<plural-noun>`; operator routes `/maintenance/...`; `/health`. Write the contract in `plan.md` before code: method, path, request, response, status, error codes.
- Additive within `v1`: new optional field, endpoint or `code`. Consumers ignore unknown fields. A new `code` needs its frontend mapping in the same plan.
- Breaking (remove, rename, retype, change meaning or status, new required input): while the site is not live, change both repos in ordered PRs, backend first and tolerant, and say so in each PR. Once live: `/v2` or expand then contract, by the user's decision.
- Persisted fields: expand, backfill, contract (`aip-change-impact`). Schemas: expand then contract over two infra releases. Workflow inputs: semantic versioning of `ai-platform-workflows`.

## Reliability

| Concern          | Rule                                                                  | Copy from                                                        |
| ---------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Outbound call    | A timeout on every call; fail with a `code`, never hang               | frontend `api-client.js` (`AbortController`, 5 s)                |
| Retry            | Idempotent operations only, bounded, with backoff                     | `acquireLockWithRetry` in backend `common/helpers/mongo-lock.js` |
| Create           | `Idempotency-Key`; deterministic external ids so a retry updates      | `adapters/azure/apim-credential-issuer.js`                       |
| Multi-step write | Lock, release in `finally`, small locked section                      | `services/credential-service.js`                                 |
| Unknown state    | Fail closed: deny or mark `failed` with the reason; no silent default |                                                                  |
| Startup work     | Idempotent and claimable                                              | `common/backfills/run-backfills.js`                              |
| Signals          | One structured log per failure with its `code`, no PII                | `aip-cdp`                                                        |

A new external call without a timeout, or a retry of a non-idempotent call, is a finding.

## Split a module, or propose a service

Default to a modular split inside the repo: a new service module, adapter, route file or component. Propose one when a file holds two responsibilities or passes about 400 lines. Measure; do not guess:

```powershell
Get-ChildItem <repo>\src -Recurse -Filter *.js | Where-Object Name -notlike '*.test.js' | Sort-Object Length -Descending | Select-Object -First 5 FullName, Length
```

Propose a new deployable service only when two or more hold: a separate data owner; a different runtime or scaling need (long jobs, queues, schedules that would block requests); a separate security boundary or credentials; a different release cadence or team; failure that must be isolated. State the cost: a CDP service (Portal entry, repo, pipelines, config, secrets, egress), a new contract to version, a network hop, more journeys. Record it as a decision (`aip-design`). The Planner proposes, the user decides at G1, the Reviewer flags growth as a minor finding with the measured size.
