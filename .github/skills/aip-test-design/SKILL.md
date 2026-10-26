---
name: aip-test-design
description: 'Decide what to test and judge test quality for AI Platform changes: map every acceptance criterion to tests, cover positive, negative, edge and requirement-validation cases, pick the right layer (testing pyramid), name tests by behaviour, and spot bad tests (implementation-coupled, own-module mocks, coverage padding, weakened assertions, flaky waits). Use when planning tests, writing tests, reviewing tests, or deciding if a change is well tested.'
license: OGL-UK-3.0
---

# Test design

Sources: Defra [QA standards](https://github.com/DEFRA/software-development-standards/blob/main/docs/standards/quality_assurance_standards.md) and [Copilot guide, Supporting testing](https://github.com/DEFRA/software-development-standards/blob/main/docs/guides/github_copilot.md), the AICE `javascript-testing-standards` skill. Mechanics: `aip-test-node`, `aip-test-journey`, Terraform in `aip-build-terraform`.

## From requirement to tests

For each AC, list the cases before writing code:

| Kind        | Question it answers                      | Example (team credential request)                                    |
| ----------- | ---------------------------------------- | -------------------------------------------------------------------- |
| Positive    | Does the promised behaviour happen?      | An Admin requests a credential and gets 201 with `keyHint`           |
| Negative    | Is the wrong thing refused, safely?      | A Member gets 403 `not-team-admin`; nothing is written               |
| Edge        | Boundaries, empty, limits, timing        | Third secret allowed, fourth refused; expired window                 |
| Failure     | Dependencies fail or are slow            | Graph 500 gives a stable code and no partial record                  |
| Requirement | The AC end to end, in the domain's words | "a suspended team cannot use a credential within the token lifetime" |

Negative cases matter as much as positive ones. Every AC has at least one positive and one negative test.

## Pick the layer

Most cases at unit and API level (`server.inject`); journeys only for flows a person walks; one journey test per journey, not per rule.

## Good tests

- Fail without the change they cover (watch it go red first).
- Assert observable behaviour: response, rendered content, persisted record, emitted audit, outbound request.
- One behaviour each; named as a sentence: "refuses a credential request from a Member".
- Deterministic: fixed clock and `TZ=UTC`, no sleeps, no order dependence, synthetic data only.

## Bad tests (reject in review)

| Smell                                                       | Instead                                               |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| Mocking this repo's own modules to test wiring              | Test through the public entry (`server.inject`, port) |
| Asserting a spy was called when the call is not the outcome | Assert the outcome; spy only on external side effects |
| Test written to raise coverage                              | Test a scenario someone cares about, or none          |
| Near-duplicates with trivial data changes                   | One test, or `test.each` with distinct cases          |
| Weakened or deleted assertion to go green                   | Find why it fails; fix code or the requirement        |
| Snapshot of a whole page                                    | Assert the heading, error summary, key content        |
| `pause()`, sleeps, retries to hide flakiness                | Wait on a condition; fix the race                     |
| Testing the framework (Joi, Hapi, GOV.UK macro)             | Test your rules on top of it                          |

## Coverage

At least 90 percent overall and never below the base (Defra MUST); aim for 95 percent on core logic and 100 percent of error and security paths. Coverage is a floor, not the goal: an uncovered line in a changed file is a question, a covered line with no assertion is a bad test.
