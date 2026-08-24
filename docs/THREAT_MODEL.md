# Threat model

## Protected assets

- Database and provider credentials.
- Discord webhook URLs.
- Analyst annotations and attribution notes.
- Ledger coverage, checkpoints, evidence provenance, config hashes, and model versions.
- Integrity of normalized events, features, scores, reports, and alert state.

## Trust boundaries

Token YAML, XRPL responses, provider errors, analyst metadata, and Discord responses are untrusted input. Validate configuration before network or database work, normalize only validated ledger data into final evidence, escape untrusted display text, and redact credentials before logging or reporting.

GitHub Actions artifacts and caches are not authoritative mutable storage. Production batch mode uses externally persisted PostgreSQL. SQLite permits one worker only.

## Primary threats and controls

| Threat                                          | Initial control                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Secret committed or logged                      | Ignored environment files, environment-variable references, secret-shaped value scan, structured redaction contract |
| False identity or ownership claim               | Typed observation/inference language, evidence provenance, no label propagation                                     |
| Exchange or faucet creates false wallet cluster | Hub suppression and two independent evidence families for high association                                          |
| Proposed or stale data affects an alert         | Validated-only persistence, freshness and gap gates                                                                 |
| Replay or overlapping workers duplicate state   | Unique canonical keys, transactional checkpoints, database job locks, idempotency tests                             |
| Historical leakage inflates results             | Repository methods bounded by `as_of_ledger` and leakage tests                                                      |
| Malicious metadata triggers Discord mentions    | Length limits, Markdown escaping, disabled mentions, displayed-only links                                           |
| Provider redirects or credential exfiltration   | `wss:`/`https:` validation, capability-aware adapters, no server-side metadata fetches                              |
| Unauthorized execution or custody               | Read-only runtime boundary with no signing, submission, seed, private-key, or wallet-generation path                |

## Future execution boundary

Autonomous or funded-wallet operation is outside the current specification. If considered later, it requires a separate reviewed specification, isolated service and credentials, transaction-policy limits, human-controlled funding and revocation, simulation and staged rollout, loss limits, incident response, and explicit authorization. Confidence in surveillance readings alone does not authorize adding signing capability to this runtime.

## Security verification

Each change runs formatting, lint, strict type-check, tests with coverage, migration parity, build, and secret-shaped value scanning. Security-sensitive behavior requires fixtures proving redaction and the absence of transaction-submission paths as the relevant phases land.
