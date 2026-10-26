---
name: aip-cdp
description: 'Defra Core Delivery Platform (CDP) facts for AI Platform services: config and secrets (redeploy to apply), proxy egress allow-lists, ECS logging, tracing with x-cdp-request-id, EMF metrics, health checks, environments, deploying through the Portal, journey and performance tests, SonarCloud, PII-in-logs process and Azure access from CDP. Use when building, configuring, testing, deploying or troubleshooting the frontend or backend on CDP.'
license: OGL-UK-3.0
---

# CDP

Source: [DEFRA/cdp-documentation](https://github.com/DEFRA/cdp-documentation) (internal to the DEFRA organisation: read it with `gh api repos/DEFRA/cdp-documentation/contents/<path> -H "Accept: application/vnd.github.raw"`; paths below checked 22 Oct 2026). AIP specifics: `ai-platform-frontend/docs/plans/implemented/05-platform-and-gitops-pipeline.md` (CDP dev). `cdp-app-config` and `cdp-tenant-config` are private: ask a person for their content.

| Topic         | Fact                                                                                                      | Source                                            |
| ------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Container     | One Linux x86 image; listens on `PORT`; `/health` checked by curl; logs to stdout                         | `architecture/absolute-minimum-requirements.md`   |
| Data stores   | Backend MongoDB; frontend Redis                                                                           | same                                              |
| Config        | PR to `cdp-app-config` (`services/<svc>/<env>/`); no secrets; applies only on **redeploy**                | `how-to/config.md`                                |
| Secrets       | Portal Secrets tab per environment; values unreadable; applies only on **redeploy**                       | `how-to/secrets.md`                               |
| Egress        | All outbound HTTP through the proxy (`HTTP_PROXY`); allow-list by PR to `cdp-tenant-config` squid config  | `how-to/proxy.md`                                 |
| Logging       | ECS subset to OpenSearch; a field's type is fixed by its first value (a mismatch drops the log)           | `how-to/logging.md`                               |
| PII in logs   | Tell #cdp-support, fix the code, CDP purges, team emails the security team                                | `how-to/pii-exposure-in-logs.md`                  |
| Tracing       | Propagate `x-cdp-request-id` (`hapi-tracing`) into `trace.id` and outbound calls                          | `how-to/tracing.md`                               |
| Metrics       | `aws-embedded-metrics` (EMF); Grafana dashboards and alerts                                               | `how-to/custom-metrics.md`                        |
| Environments  | dev, test, perf-test, ext-test, prod; auto-deploy non-prod only                                           | `how-to/auto-deployment.md`                       |
| Deploy        | A person deploys an image version in the Portal; hotfix builds `x.y.z-hotfix-*`; shuttering in the Portal | `how-to/hotfix-builds.md`, `how-to/shuttering.md` |
| Journey tests | Portal runs latest build in dev, test, perf-test; `PROFILE`; 2-hour limit; Allure report                  | `how-to/testing/testing.md`                       |
| Performance   | JMeter suites, perf-test only; schedulable                                                                | `faq/performance-testing.md`                      |
| Sonar         | SonarCloud via GitHub Actions, automatic analysis off, Defra default gate                                 | `how-to/sonarcloud.md`                            |
| Azure         | Private Link and firewall rules use CDP's per-environment CIDR ranges                                     | `how-to/azure.md`                                 |
| Identity      | Workload identity to Entra via AWS web identity token (`@defra/hapi-auth-oidc`)                           | `how-to/federated-credentials/`                   |

## Consequences for plans

- A new env var or secret is a task for a person (config PR or Portal) plus a redeploy; list it in `plan.md` rollout.
- A new outbound host needs a proxy allow-list PR before the feature works in CDP.
- New log fields keep one type everywhere; never log a whole object that may carry personal data.
