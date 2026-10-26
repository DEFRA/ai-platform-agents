---
name: aip-change-impact
description: 'Assess whether an AI Platform change is breaking or needs a backfill, migration or staged rollout: persisted MongoDB fields, API contracts, error codes, GitOps schemas and team files, Terraform replace or destroy, reusable workflow majors, CDP config and secrets, routes and journeys people use. Checks whether the platform is live for real customers. Use when planning, reviewing or shipping a change that removes, renames or reshapes anything.'
license: OGL-UK-3.0
---

# Change impact

Refactor and remove freely while nothing depends on it. Call out loudly when something real does.

## Is it live?

Check before assuming: each repo's `copilot-instructions.md` (today: "The site is not live: build to the current design only"), `remaining.md` and the environments in `registry.json`. If people or teams use an environment, treat that environment as live. Record the answer and its source in `brief.md`.

## Impact table (one row per affected thing)

| Change                               | Not live                        | Live: required                                                                   |
| ------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------- |
| New or renamed MongoDB field         | Change and reseed               | Readers tolerate absence, backfill entry, expand then contract                   |
| API response or error `code`         | Change both repos together      | Additive first; frontend and backend released in a safe order                    |
| Route path or journey step           | Change and update journey tests | Redirect old paths; tell users; update help content                              |
| Team file or pin schema              | Change schemas and examples     | Expand then contract across two infra releases                                   |
| Terraform address or resource        | `moved` block                   | `moved` block; no replace of APIM, Foundry, vaults, state; plan shows no destroy |
| Reusable workflow input or behaviour | Patch or minor                  | Major version; callers move by reviewed Dependabot PR                            |
| CDP config, secret, egress           | Note the redeploy               | Change in each environment before the code that needs it                         |
| Credential or identity behaviour     | Change                          | Never invalidate issued credentials silently; plan rotation                      |

## Output

In `plan.md` and the PR body: `Impact: none` or `BREAKING: {what}, {who}, {mitigation}` and `BACKFILL: {collection, field, entry}`. Any `BREAKING` on a live environment needs the user's explicit yes at G1.
