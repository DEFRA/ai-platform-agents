# Question bank

Pick the few that change the outcome. Offer options and a recommendation.

## Outcome and scope

- Who uses this (role, tier: research or team, environment) and what can they do afterwards that they cannot now?
- Is this a new feature, a change to something built, or a fix? Which plan item or story?
- What is explicitly out of scope for this change?

## Behaviour

- What does the person see on success, validation error, no permission, not found, upstream failure and empty state?
- Which roles may do this (Member, Admin, platform admin)? What happens to the others: 403 or hidden?
- Is the action idempotent? What happens on a retry or double submit?

## Data and contract

- New or changed persisted fields? Existing documents will lack them: readers must tolerate that, and anything that queries the field needs a backfill.
- New API route or changed response? Which error `code` values does the frontend map?
- Any personal data, secrets or credentials shown, stored or logged?

## Platform and infrastructure

- Does it change Terraform, schemas, the catalogue, workflows or environment parameters?
- Which environments, and in which order? Any Azure policy, quota or region limits?
- Is a design or decision change needed first in the discovery site?

## Quality and delivery

- Journey or accessibility coverage needed beyond unit and integration tests?
- Any deadline, demo or dependency on another team (CDP, CCoE, Entra admins)?
- Release path: just merged, released, pinned, applied?
