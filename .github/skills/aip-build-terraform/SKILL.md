---
name: aip-build-terraform
description: 'Build AI Platform Terraform in ai-platform-infra: modules, the platform, tenants, bootstrap and names roots, schemas, catalogue and aip-checks. Where things go, the test-first order, offline commands and plan reasoning. Never applies. Use when changing .tf, .tftest.hcl, schemas, catalogue, APIM policy XML or aip-checks.'
license: OGL-UK-3.0
---

# Build: Terraform and platform IaC

The rules are the repo's, read before the first edit and never restated here: `ai-platform-infra/.github/copilot-instructions.md` (review risks, conventions, PR steps), `.github/instructions/terraform.instructions.md` (practices; positive, negative, edge, rendered and regression tests), `docs/modules.md`, `docs/gitops-contract.md`. This skill adds the map, the order and the commands.

## Map

| Folder                                          | Holds                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `modules/<name>/`                               | One concern; standard files and `tests/`                                                             |
| `platform/`, `tenants/`, `bootstrap/`, `names/` | Roots                                                                                                |
| `schemas/`                                      | JSON schemas for team files, pins and parameters                                                     |
| `catalogue/`                                    | Model offerings; a change needs a release and the backend's `CATALOGUE_REF` moved                    |
| `checks/`                                       | `aip-checks` CLI (ES modules, vitest); `tests/unit/policy-expressions.test.js` pins APIM expressions |

## Order

1. Read the module and its tests; copy the nearest pattern.
2. Write the failing `.tftest.hcl` runs first, then the HCL.
3. Address changes get a `moved` block. In the return and the PR, say what a plan would show (create, update, replace, destroy) and which tests cover which resources, validations and branches.
4. Update `docs/` and `examples/` where behaviour changes.

## Commands

| Task            | Command                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Format          | `terraform fmt -recursive`                                                                                        |
| Test one folder | `terraform -chdir=<dir> init -backend=false -input=false` then `terraform -chdir=<dir> test`                      |
| Validate a root | `terraform -chdir=<root> init -backend=false -input=false -lockfile=readonly` then `validate`                     |
| aip-checks      | `npm test --prefix checks`; `npm run lint --prefix checks`                                                        |
| All gates       | `node <aip-quality-gates>/scripts/run-gates.mjs --repo <infra> --quick` (`--full` adds tflint, checkov, Snyk IaC) |

CI runs the same through `ai-platform-workflows/scripts/infra-checks.sh`. `apply`, `destroy`, `import` and `state` changes are pipeline-only; the guard hook blocks them.
