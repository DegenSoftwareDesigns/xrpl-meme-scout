# Operations

## Current phase

Phase 0 provides the repository contracts and configuration validator. Ledger ingestion, database migrations, scoring, Discord delivery, and production workers arrive in later phases and must not be treated as operational until their phase acceptance tests pass.

## Local setup

Requirements are Node.js `24.14.1`, pnpm `10.33.2`, Git, and Docker for later PostgreSQL contract tests.

```sh
pnpm install --frozen-lockfile
pnpm scout config validate --config-dir config/tokens
pnpm migrations:check
```

Copy `.env.example` to an untracked `.env` only when a command needs provider or database settings. Keep values out of command arguments, logs, issues, pull requests, and committed YAML.

## Configuration changes

1. Edit or add one `config/tokens/*.yaml` file.
2. Run `pnpm config:schema` after changing the TypeScript configuration contract.
3. Run the full green gate in `AGENTS.md`.
4. Review the emitted canonical token tuple and config hash.

Alerts remain disabled in `drop.yaml`. Enabling delivery is a Phase 5 production decision after historical coverage, score explanations, false positives, and a redacted dry run have been reviewed.

## Database migrations

PostgreSQL and SQLite migrations use matching filenames of the form `NNNN_description.sql`. Phase 0 intentionally has no schema migrations. `pnpm migrations:check` verifies filename validity and backend parity; application startup never creates or mutates schema implicitly.

Before applying a future migration:

1. back up the database;
2. verify the backup can be read;
3. apply the migration through the explicit CLI command introduced in Phase 1;
4. run repository contract checks; and
5. retain a documented forward-fix or restore path.

## Backups and retention

Production PostgreSQL will require encrypted daily backups, restricted storage access, retention monitoring, and periodic restore drills. SQLite is limited to one local or VPS worker and requires a consistent file-level backup while writes are paused or coordinated through its backup API. Raw relevant payloads default to 90 days; aggregates, evidence links, event labels, scores, and alert records are retained.

## Provider gaps and rate limits

A provider's advertised complete ledger range is a hard capability boundary. Missing requested history creates a coverage gap, and an event study configured to require complete history fails. Live workers must repair the interval after the last committed checkpoint before scoring resumes.

Treat load warnings, timeouts, HTTP `503`, WebSocket `1008`, and connection resets as backoff events. Failover is permitted only to a provider that advertises the required range and capability. Never advance an affected score past an unresolved gap.

## Secret rotation

If a Discord webhook, provider credential, or database credential is exposed:

1. revoke or rotate it at the provider immediately;
2. replace it in the approved GitHub or VPS secret store;
3. search repository history, logs, Actions artifacts, and backups for exposure;
4. remove or restrict affected artifacts without rewriting shared history unless the owner separately authorizes an incident procedure; and
5. document the incident privately.

The application and its tests must redact credential-bearing URLs and webhook responses. `.env` files, database dumps, and raw secret values are never diagnostic artifacts.

## Alert troubleshooting

Discord delivery is not implemented in Phase 0. In Phase 5, troubleshoot from the persisted alert fingerprint and attempt record rather than manually resending. Verify coverage, freshness, evidence-family count, cooldown, hysteresis, response class, and redaction before retrying. A dry run writes no Discord request or delivered-alert state.

## Rollback

Application changes roll back through a reviewed pull request that reverts or forward-fixes the scoped change. Do not force-push shared history. Data changes use the migration-specific restore or forward-fix plan, and a rollback is complete only when health checks, data coverage, and the last committed validated checkpoint are verified.
