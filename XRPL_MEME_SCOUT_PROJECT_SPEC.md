# xrpl-meme-scout — Project Specification

- **Status:** Implementation-ready specification
- **Canonical repository:** [`DegenSoftwareDesigns/xrpl-meme-scout`](https://github.com/DegenSoftwareDesigns/xrpl-meme-scout)
- **Clone URL:** `https://github.com/DegenSoftwareDesigns/xrpl-meme-scout.git`
- **Initial token:** DROP on XRPL Mainnet
- **Primary output:** Evidence-based alerts to Discord
- **Runtime modes:** Scheduled batch analysis and continuous monitoring

## 1. Mission

Build a read-only surveillance system for XRPL memecoins that detects on-ledger behavior consistent with preparation for a coordinated pump. The first monitored token is DROP, but every token-specific fact must live in configuration so another issued token can be added without changing application code.

The system must:

1. ingest validated XRPL data;
2. maintain an idempotent local history of relevant transactions, balances, markets, and wallet relationships;
3. identify historical pump events and study their preceding windows;
4. calculate explainable wallet, liquidity, order-book, and market features;
5. produce a versioned **Pump Precursor Score** (`PPS`, 0–100);
6. alert through a Discord incoming webhook when evidence and data-quality gates are met; and
7. preserve the evidence behind every score so an analyst can reproduce it.

This is a surveillance and research tool, not a trading bot, identity-resolution service, accusation engine, or guarantee of future performance. It must never submit XRPL transactions or hold wallet secrets.

## 2. Interpretation and evidence policy

All language in code, reports, and alerts must distinguish observations from inferences.

- **Observation:** a validated transaction, balance change, trust line, offer, AMM reserve change, or timing relationship.
- **Inference:** an address may be behaviorally related to other addresses, or activity may resemble a historical precursor pattern.
- **Unsupported assertion:** a named person or project controls an address or cluster without independent evidence.

Wallet clustering is probabilistic. A clustering score means **strength of on-ledger association under named heuristics**, not probability of common ownership and not proof of identity. Alerts must use phrases such as “behaviorally linked addresses” or “addresses with shared funding evidence.” They must not say “the developer's wallets,” “same owner,” “insiders,” or equivalent unless a separately recorded, reviewable evidence source supports that exact attribution.

Common exchange funders, market makers, hubs, faucets, and service accounts create false links. Hub suppression and counter-evidence are required. A wallet label supplied by configuration is an analyst annotation, not a fact, unless its evidence record says why it is factual.

## 3. Initial monitored asset

The canonical token key is the tuple `(network, issuer, currency)`, never the display symbol alone.

| Field          | Initial value                                                      |
| -------------- | ------------------------------------------------------------------ |
| Network        | XRPL Mainnet                                                       |
| Token ID       | `drop`                                                             |
| Display symbol | `DROP`                                                             |
| Currency code  | `44524F5000000000000000000000000000000000`                         |
| Issuer         | `rszenFJoDdiGjyezQc8pME9KWDQH43Tswh`                               |
| Primary quote  | XRP                                                                |
| Venues         | XRPL AMM discovery plus both directions of the XRPL DEX order book |

The 40-character value is a non-standard 160-bit hexadecimal currency code. Preserve it exactly in storage and API requests; `DROP` is display metadata only. XRPL identifies issued fungible assets by both currency and issuer, and issued amounts must use decimal-safe arithmetic.

## 4. Product boundaries

### In scope

- Validated Mainnet transactions and metadata relevant to configured tokens, markets, and candidate wallets.
- Issued-token balance changes, XRP funding flows, trust-line activity, DEX offers/trades, AMM state and liquidity changes.
- Historical event labeling, event studies, deterministic feature calculation, backtesting, and recurring-wallet analysis.
- Probabilistic behavioral graphs and clusters with evidence provenance.
- Scheduled or live scoring, alert deduplication, and Discord delivery.
- Multiple tokens loaded from validated YAML files.

### Out of scope for the initial repository

- Trading, transaction signing, seed phrases, private keys, custody, or automated execution.
- Claims about legal manipulation, fraud, identity, or wallet ownership.
- Social-media sentiment, private chat data, IP/device data, or off-ledger deanonymization.
- A public dashboard, user accounts, or multi-tenant access control.
- Machine-learning models that cannot explain feature contributions.

## 5. Required technology decisions

Use the following stack unless an implementation-time compatibility check proves a component unsuitable:

- Node.js `24.x` LTS, pinned in `.node-version` and `package.json` engines.
- TypeScript in strict mode, ESM modules, and `pnpm` with a committed lockfile.
- `xrpl` (`xrpl.js`) for XRPL WebSocket/API types and metadata utilities.
- `decimal.js` for all XRP/token/price/volume calculations. JavaScript `number` is acceptable only for bounded scores, counts, timestamps, and configuration ratios.
- `zod` plus `yaml` for configuration parsing; export JSON Schema for editor support.
- `kysely` with PostgreSQL and SQLite adapters. PostgreSQL is the production default; SQLite is supported for local development and a single-process VPS.
- `pino` for structured logs.
- `vitest`, test fixtures, ESLint, and Prettier for verification.
- Native `fetch` for Discord delivery, wrapped behind a testable adapter.

Pin exact dependency versions in `pnpm-lock.yaml`. Use database migrations; never mutate the schema implicitly on application startup.

## 6. High-level architecture

```text
Token YAML files
      │
      ▼
Config loader ──► provider capability check
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
    batch/backfill worker      live WebSocket worker
            │                       │
            └───────────┬───────────┘
                        ▼
              canonical normalizer
                        │
                        ▼
             idempotent SQL storage
                        │
            ┌───────────┼──────────────┐
            ▼           ▼              ▼
       market state  wallet graph  event-study labels
            └───────────┼──────────────┘
                        ▼
                  feature engine
                        ▼
               Pump Precursor Score
                        ▼
            alert gates + deduplication
                        ▼
              Discord webhook adapter
```

### Module contracts

1. **Config loader:** validates all files before any network or database work. Unknown keys are errors. It emits an immutable, canonical config object and SHA-256 config hash.
2. **Provider adapter:** exposes capability-aware methods rather than leaking vendor-specific responses. It reports available ledger ranges and whether archive history, subscriptions, and API v2 are supported.
3. **Ingestion workers:** obtain validated data, resume from checkpoints, detect gaps, and hand raw responses to the normalizer.
4. **Normalizer:** turns XRPL responses into canonical domain events. It is pure and fixture-testable.
5. **Repository layer:** performs transactional, idempotent writes and advisory/job locking.
6. **Feature engine:** computes values for a token, window, and `as_of_ledger`; it never reads data later than that ledger.
7. **Graph engine:** creates time-bounded evidence edges and behavioral clusters without propagating identity labels.
8. **Event-study engine:** labels historical events, selects controls, measures precursor lift, and produces reproducible reports.
9. **Score engine:** maps named feature values to a deterministic score and contribution list under a versioned model definition.
10. **Alert engine:** applies quality, threshold, cooldown, hysteresis, and deduplication rules before delivery.

## 7. Repository structure

```text
xrpl-meme-scout/
├─ .github/
│  ├─ dependabot.yml
│  └─ workflows/
│     ├─ ci.yml
│     ├─ monitor.yml
│     └─ historical-study.yml
├─ config/
│  ├─ schema/
│  │  └─ token.schema.json
│  └─ tokens/
│     └─ drop.yaml
├─ docs/
│  ├─ OPERATIONS.md
│  ├─ SCORING.md
│  └─ THREAT_MODEL.md
├─ migrations/
│  ├─ postgres/
│  └─ sqlite/
├─ reports/
│  └─ .gitkeep
├─ src/
│  ├─ cli.ts
│  ├─ config/
│  ├─ domain/
│  ├─ providers/xrpl/
│  ├─ ingestion/
│  ├─ normalization/
│  ├─ storage/
│  ├─ markets/
│  ├─ graph/
│  ├─ features/
│  ├─ scoring/
│  ├─ studies/
│  ├─ alerts/
│  ├─ observability/
│  └─ workers/
├─ test/
│  ├─ fixtures/xrpl/
│  ├─ unit/
│  ├─ integration/
│  ├─ replay/
│  └─ smoke/
├─ .env.example
├─ .gitignore
├─ .node-version
├─ AGENTS.md
├─ CHANGELOG.md
├─ Dockerfile
├─ docker-compose.yml
├─ LICENSE
├─ package.json
├─ pnpm-lock.yaml
├─ README.md
├─ tsconfig.json
└─ vitest.config.ts
```

`reports/` contains generated Markdown/JSON reports locally and as CI artifacts; generated reports are not committed by default. `AGENTS.md` must point Codex to this specification, the config schema, and the commands that prove completion, while leaving discoverable package-script details in `package.json`.

## 8. Token configuration contract

Each `config/tokens/*.yaml` file is independently valid. The schema version is mandatory. Wallet addresses and asset tuples must be validated with `xrpl.js`; weights must sum to `1.0` within a tolerance of `1e-9`; identifiers must be unique; durations must be positive; all percentage thresholds are expressed as percentages rather than fractions unless the field name ends in `_ratio`.

Secrets and provider credentials are forbidden in token YAML. Configuration may name an environment variable, but never contain its value.

### Initial `config/tokens/drop.yaml`

```yaml
schema_version: 1

token:
  id: drop
  enabled: true
  network: mainnet
  symbol: DROP
  name: DROP
  issuer: rszenFJoDdiGjyezQc8pME9KWDQH43Tswh
  currency: "44524F5000000000000000000000000000000000"
  metadata:
    tags: [memecoin]
    description: "Initial monitored asset. Symbol is display-only; issuer and currency are canonical."
    links: []

history:
  from_ledger: null
  to_ledger: validated
  require_complete_range_for_event_study: true
  raw_retention_days: 90

markets:
  - id: drop_xrp
    base:
      type: issued
      issuer: rszenFJoDdiGjyezQc8pME9KWDQH43Tswh
      currency: "44524F5000000000000000000000000000000000"
    quote:
      type: xrp
    venues:
      - type: amm
        discover: true
        amm_account: null
      - type: dex_order_book
        directions: both
    depth_notional_xrp: [100, 500, 1000, 5000]

known_wallets:
  - address: rszenFJoDdiGjyezQc8pME9KWDQH43Tswh
    labels: [issuer]
    role_hint: issuer
    attribution:
      status: protocol_fact
      source: token_config
      note: "Issuer from the canonical token tuple; no identity claim."

analysis:
  windows_minutes: [15, 60, 360, 1440, 10080]
  baseline_days: 30
  minimum_baseline_samples: 20
  precursor_windows_hours: [1, 6, 24, 168]
  pump_event:
    forward_horizon_hours: 24
    minimum_token_xrp_return_pct: 50
    minimum_quote_volume_xrp: 1000
    collapse_gap_hours: 72
  graph:
    funding_lookback_hours: 72
    synchronized_action_minutes: 10
    max_funding_hops: 2
    hub_unique_counterparties_30d: 100
    minimum_cluster_edge_score: 0.55

score:
  version: pps-v1
  warn_robust_z: 1.5
  critical_robust_z: 4.0
  features:
    newly_funded_buyers: 0.15
    coordinated_accumulation: 0.18
    common_funding_evidence: 0.15
    liquidity_withdrawal: 0.12
    sell_side_depth_thinning: 0.08
    quiet_price_buy_pressure: 0.07
    repeat_precursor_wallets: 0.15
    trustline_creation_burst: 0.05
    holder_concentration_increase: 0.05

alerts:
  enabled: false
  destination: discord
  webhook_env: DISCORD_WEBHOOK_URL
  minimum_score: 60
  levels:
    elevated: 60
    high: 75
    critical: 90
  minimum_feature_families: 2
  minimum_data_coverage_ratio: 0.65
  maximum_data_age_seconds: 90
  cooldown_minutes: 360
  realert_score_increase: 10
  recovery_below_score: 45
```

### Extensibility rules

- Adding a token consists of adding one valid YAML file and running migrations only if the generic schema itself changed.
- A token may declare multiple XRP or issued-token quote markets, AMMs, and order books.
- `discover: true` resolves and stores the AMM account using `amm_info`. If an explicit AMM account is configured, startup must verify that its two assets match the configured pair.
- `known_wallets` accepts `labels`, `role_hint`, `valid_from`, `valid_to`, and an attribution record. Labels do not transitively spread to connected wallets.
- Per-token thresholds override application defaults. The effective merged configuration and its hash must be stored with every score.
- A disabled token remains queryable historically but is not ingested or scored.

## 9. XRPL data ingestion

### 9.1 Source requirements

Support an ordered list of XRPL providers via environment configuration. At startup, query each provider for server health, API version, validated ledger, complete ledger range, and required capabilities. Prefer API v2 where supported.

The system must explicitly distinguish:

- `validated`: final data eligible for balances, features, scores, and alerts;
- `proposed`: optional diagnostic data that is never persisted as final evidence or used for alerts; and
- `unknown/stale`: data that fails the alert freshness gate.

Public XRPL servers can rate-limit by IP and may not retain the requested historical range. A provider returning less history than requested is a recorded coverage gap, not a successful backfill.

### 9.2 Live mode

Maintain one reconnecting WebSocket connection per active provider role.

- Subscribe to the validated `ledger` stream to advance checkpoints.
- Subscribe to configured books and known/candidate accounts where supported.
- For complete future token-flow discovery, use the validated `transactions` stream and filter transaction metadata locally for the configured issuer/currency tuples. Make this high-volume subscription configurable per provider.
- On every reconnect, backfill the ledger interval after the last committed checkpoint before resuming live processing.
- Treat WebSocket close code `1008` with reason `threshold exceeded`, load warnings, and provider overload as rate-limit events.
- Commit a ledger checkpoint only after all relevant events and snapshots through that ledger have been stored transactionally.

### 9.3 Batch and historical mode

Batch mode runs from the last checkpoint to the provider's latest validated ledger. Historical mode takes an explicit ledger or time range and pages deterministically.

Use the official APIs as follows:

- `ledger` with transactions and metadata for bounded ledger scanning when complete token-flow discovery is required;
- `account_tx` for paginated history of known or discovered wallets, never as a substitute for all transfers of an issued token;
- `tx` to reconcile a transaction by hash;
- `amm_info` at a specific validated ledger for AMM discovery and state;
- `book_offers` in both directions at a specific validated ledger for funded DEX depth;
- `account_lines` for a known wallet's trust-line state;
- `gateway_balances` for issuer-level supply checks, not holder chronology; and
- `server_info`/equivalent capability calls for health and available ranges.

Full historical event studies require a full-history Clio/xrpld provider, a self-hosted archive, or an already indexed dataset. The issuer's `account_tx` history alone does not enumerate every peer-to-peer transfer or trade between third-party holders. If the configured event-study range is incomplete, the command must fail with a coverage report when `require_complete_range_for_event_study` is true.

### 9.4 Canonical normalization

- Deduplicate transactions by `(network, transaction_hash)`.
- Preserve ledger index, transaction index, close time, result code, source provider, validated flag, and raw metadata hash.
- Derive balance changes from transaction metadata, using `xrpl.getBalanceChanges` where applicable and verified custom parsing for AMM/offer details.
- Identify issued assets by exact issuer/currency tuple. Never match on symbol or currency code alone.
- Store XRP internally as decimal XRP and retain original drops where supplied.
- Store issued amounts, prices, volumes, and reserves as canonical decimal strings. Never round before feature presentation.
- Represent transaction order as `(ledger_index, transaction_index)`; wall-clock timestamps alone do not define ledger order.
- Keep multi-asset path payments and ambiguous economic intent marked as such. A token inflow plus XRP outflow can support a buy inference; a `Payment` transaction type by itself cannot.
- Record all AMM, offer, trust-line, and account-setting changes touching configured assets even when they do not count as trades.

## 10. Persistence model

Create migrations for at least these logical tables:

| Table                   | Purpose and key constraint                                                            |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `tokens`                | Canonical token tuple and config hash; unique network/issuer/currency                 |
| `markets`               | Token pair and venue definition; unique token/market ID                               |
| `ledgers`               | Validated ledger header and close time; unique network/index                          |
| `transactions`          | Relevant canonical transaction plus optional compressed raw JSON; unique network/hash |
| `balance_changes`       | Per-account asset delta tied to transaction and ledger                                |
| `market_actions`        | Normalized swap, offer, AMM deposit/withdrawal, or ambiguous market action            |
| `market_snapshots`      | AMM reserves, price, fee, DEX spread and depth at an as-of ledger                     |
| `trustline_events`      | Created, modified, and removed relevant trust lines                                   |
| `wallets`               | First/last seen, analyst annotations, and service/hub status                          |
| `funding_edges`         | XRP/token funding edges with amount, time, hop source, and evidence provenance        |
| `behavior_edges`        | Typed association evidence, score, version, first/last seen, and expiry               |
| `clusters`              | Versioned behavioral cluster result; never an ownership record                        |
| `cluster_memberships`   | Address, cluster, association strength, and evidence list                             |
| `feature_values`        | Raw, baseline, normalized value, status, window, and as-of ledger                     |
| `pump_events`           | Versioned historical label and collapse group                                         |
| `event_windows`         | Event/control window membership and no-leakage cutoffs                                |
| `scores`                | PPS, coverage, freshness, contributions, model/config hashes                          |
| `alerts`                | Alert fingerprint, status, attempt count, response class, and timestamps              |
| `ingestion_checkpoints` | Last completely committed ledger by token/source/worker                               |
| `coverage_gaps`         | Missing ledger ranges and resolution state                                            |
| `source_health`         | Latency, failures, load warnings, and provider capability snapshots                   |

All foreign keys and uniqueness constraints must be enforced. Replaying the same ledger range must leave row counts and aggregates unchanged. PostgreSQL uses advisory locks; SQLite uses a single-process lock table and WAL mode. Long-term aggregates, scores, event labels, and alert records are retained; raw relevant payloads default to 90 days unless required for a pinned study. Backups and retention must be documented in `docs/OPERATIONS.md`.

## 11. Historical event study

The event study answers: **which on-ledger features and addresses occurred disproportionately before historical DROP/XRP outperformance?** It does not retroactively prove orchestration.

### 11.1 Event labeling

For model version `pps-v1`, label a candidate historical pump when the maximum forward DROP/XRP return from an anchor reaches the configured `minimum_token_xrp_return_pct` within `forward_horizon_hours` and the period meets `minimum_quote_volume_xrp`. Collapse overlapping candidates inside `collapse_gap_hours` into one event, retaining the earliest eligible anchor and the peak.

Because DROP/XRP is already a relative price, a positive return is DROP outperformance versus XRP. If an external XRP/USD reference is added later, store it as an optional second benchmark rather than changing old labels.

Event labels may use future data; precursor features may not. For a feature calculated at event anchor `t`, every query must be bounded at or before `t`. Enforce this with an `as_of_ledger` parameter in repository methods and leakage tests.

### 11.2 Controls and outputs

- Select multiple non-overlapping control windows matched on time-of-day, recent volatility, liquidity/depth regime, and data coverage.
- Exclude event and post-event contamination windows from controls.
- Calculate feature distributions, median lift, bootstrap confidence intervals, and event/control presence rates.
- For recurring wallets, report event-window count, control-window count, lead-time distribution, direction and amount of flows, and exact supporting transaction hashes.
- Apply a minimum sample count before calling a wallet recurrent. Flag small samples and multiple-comparison risk prominently.
- Backtest thresholds on time-ordered splits. Never tune and report performance on the same events without labeling it in-sample.
- Report alert precision, recall, false alerts per 30 days, median lead time, coverage, and sample size. Do not call PPS a “pump probability” unless a later model is demonstrably calibrated out of sample.

The CLI command must write both machine-readable JSON and a human-readable Markdown report containing the config hash, model version, provider ledger coverage, event list, controls, feature results, wallet evidence, limitations, and reproduction command.

## 12. Wallet graph and clustering heuristics

Construct a temporal, typed graph. Nodes are XRPL addresses. Edges are evidence records with a time range, provenance, feature version, hub penalty, and evidence-strength score from `0` to `1`.

Initial edge families:

1. **Direct funding:** one address funds another with XRP shortly before token acquisition or liquidity activity.
2. **Shared upstream funding:** multiple addresses receive funds from the same non-hub address within the configured interval and subsequently act similarly.
3. **Synchronized behavior:** purchases, offers, transfers, or liquidity changes occur within a narrow interval and repeat across independent periods.
4. **Circular or peel-chain flows:** value moves through a short, time-compressed path before converging on the token market.
5. **Repeated precursor co-occurrence:** addresses appear together before multiple independently labeled events more often than in controls.
6. **Lifecycle similarity:** trust-line creation, first funding, first token acquisition, and dormancy/reactivation patterns align.

Rules:

- Each edge retains the exact transactions and calculations supporting it.
- Hub/service likelihood reduces or suppresses shared-funder evidence. Never cluster solely because addresses were funded by a high-degree exchange, faucet, or service.
- A “high association” requires at least two independent evidence families; repeated versions of the same transfer pattern remain one family.
- Clusters are time- and model-version-specific. Expired evidence is not silently carried forward.
- Run sensitivity at adjacent edge thresholds and store cluster stability. Unstable memberships reduce confidence.
- Known labels remain attached only to the configured address. The graph must not propagate “issuer,” “developer,” or any identity label.
- Cluster confidence values (`low`, `medium`, `high`) describe evidence quality. The numeric association score is not a calibrated common-owner probability.

## 13. Feature definitions

Compute each feature for every configured window and store its raw inputs.

| Feature                         | Raw signal                                                                          | Feature family   |
| ------------------------------- | ----------------------------------------------------------------------------------- | ---------------- |
| `newly_funded_buyers`           | Count and net XRP of wallets funded within lookback then acquiring token            | wallet/funding   |
| `coordinated_accumulation`      | Buy-side token delta, buy imbalance, synchrony, and number of independent addresses | wallet/market    |
| `common_funding_evidence`       | Non-hub shared funding and short funding paths weighted by amount/recency           | graph/funding    |
| `liquidity_withdrawal`          | AMM reserve/depth reduction and LP withdrawal relative to baseline                  | liquidity        |
| `sell_side_depth_thinning`      | Fall in funded token sell depth at configured XRP notionals                         | order book       |
| `quiet_price_buy_pressure`      | Unusually high buy imbalance/accumulation while price response remains muted        | market           |
| `repeat_precursor_wallets`      | Recurrence and lift of addresses seen in prior event precursor windows              | historical/graph |
| `trustline_creation_burst`      | New relevant trust lines and subsequent activation versus baseline                  | wallet/lifecycle |
| `holder_concentration_increase` | Increase in concentration among observed holders/clusters, coverage-adjusted        | distribution     |

“Observed holders” must always state coverage. Do not imply a complete rich list if ingestion does not cover every relevant trust line. Effective sell-side liquidity should combine funded DEX offers and AMM executable depth for the configured notionals; total issued supply is not a substitute for tradable float.

## 14. Pump Precursor Score

PPS is an explainable anomaly/evidence index, not a probability.

### 14.1 Normalization

For feature `i`, transform a skewed non-negative raw value with `g_i(x) = log1p(x)` where appropriate. Against the rolling baseline for the same window:

```text
robust_z_i = (g_i(x) - median_i) / (1.4826 × MAD_i + epsilon_i)
signal_i   = clamp(
               (robust_z_i - warn_robust_z)
               / (critical_robust_z - warn_robust_z),
               0,
               1
             )
```

Directional features must orient anomalous precursor behavior upward before normalization. Use a documented epsilon based on the metric's measurement precision. If the baseline has fewer than `minimum_baseline_samples`, mark the feature unavailable and set its contribution to zero.

### 14.2 Score and quality

```text
PPS = round(100 × Σ(weight_i × signal_i))
coverage_ratio = Σ(weight_i for features with valid current value and baseline)
```

Weights are fixed by `score.version`, sum to `1.0`, and are never silently rebalanced around unavailable features. This prevents missing data from increasing a score. Store, for every feature, raw value, baseline median/MAD, robust z-score, normalized signal, weight, contribution, evidence IDs, and unavailability reason.

Data confidence is separate from PPS:

- **high:** coverage at least `0.85`, no unresolved gap, and data within freshness target;
- **medium:** coverage at least `0.65`, no critical source gap, and fresh data;
- **low:** anything less; low-confidence scores cannot alert.

Historical recurrence may change `repeat_precursor_wallets` only from completed earlier events. An event currently being evaluated cannot train its own score.

## 15. Alert logic

Evaluate alerts after a checkpoint and score commit.

### Mandatory gates

An alert is eligible only when all are true:

- PPS meets the configured level;
- coverage and freshness meet their minimums;
- no unresolved ledger gap overlaps any active feature window;
- at least `minimum_feature_families` independent families contribute non-zero evidence;
- the score is based only on validated ledgers; and
- the alert is neither a duplicate nor inside cooldown, unless a re-alert condition applies.

### Severity, hysteresis, and deduplication

- `60–74`: elevated; `75–89`: high; `90–100`: critical.
- Re-alert during cooldown only if PPS rises by at least `realert_score_increase`, severity rises, or a materially new evidence family appears.
- Emit one recovery message only after an alerted token falls below `recovery_below_score` for two consecutive scoring windows.
- Fingerprint an alert from token ID, model/config hashes, severity, as-of ledger bucket, and sorted material evidence IDs.
- Insert the pending alert record before delivery. Retries update the same record and Discord message rather than creating duplicates where possible.

### Discord message contract

Use an incoming webhook stored only in `DISCORD_WEBHOOK_URL` (or the environment variable named by token config). Send with `wait=true` so delivery can be confirmed. A compact embed must contain:

- token, market, severity, PPS, and data confidence;
- as-of time and validated ledger;
- current DROP/XRP move, volume, AMM depth/reserves, and DEX depth where available;
- top feature contributions with raw versus baseline values;
- behaviorally linked addresses, shortened for display but linked to a configurable XRPL explorer;
- exact counts/amounts and lead windows, not vague adjectives;
- counter-evidence, data gaps, and historical sample size;
- model/config version and alert fingerprint; and
- the disclaimer: “Heuristic on-ledger surveillance; not proof of ownership, coordination, manipulation, or future price movement.”

Respect Discord response headers and `429 retry_after`; retry `429` and `5xx` with bounded exponential backoff and jitter, up to five attempts. Do not retry ordinary `4xx` responses except `429`. Redact the webhook URL, token, query string, and response bodies that could echo credentials from every log and exception.

## 16. Rate limiting and resilience

- Use a per-provider token bucket with configurable requests/second, burst, concurrency, and cost weights. Conservative public-server defaults are `5` requests/second, burst `10`, and concurrency `2`; operators must tune them to their provider terms.
- Page sequentially where markers depend on prior responses. Batch independent token/market requests within the concurrency limit.
- Cache immutable ledgers and transactions by hash/index; cache short-lived validated market queries by ledger.
- On load warnings, HTTP `503`, WebSocket `1008`, timeouts, or connection resets, use exponential backoff with full jitter and a circuit breaker.
- Fail over only to a provider that advertises the required ledger range/capability. Store the provider used on every raw record.
- Detect gaps from ledger checkpoints and reconcile them before scoring. Do not advance past an unresolved gap for affected features.
- Acquire a database job lock so overlapping GitHub Actions or restarted workers cannot process the same range concurrently.
- Bound backfills by ledger range, wall time, and request budget; return a resumable checkpoint rather than partially claiming completion.

## 17. Runtime modes and deployment

### 17.1 GitHub Actions batch mode

Use this for the lowest-operations deployment and hourly analysis.

- `monitor.yml` runs at minute `7` of every hour and supports `workflow_dispatch`.
- Run `pnpm scout monitor --once --config-dir config/tokens`.
- Use PostgreSQL through the `DATABASE_URL` Actions secret. GitHub Actions caches/artifacts are not the authoritative mutable database.
- Use `concurrency` plus the database job lock; set a bounded job timeout.
- Set workflow permissions to `contents: read` and no broader by default.
- Upload redacted run diagnostics/report artifacts on failure; never upload `.env`, raw secrets, or database dumps.
- Scheduling is best-effort batch execution, not real-time surveillance. The official minimum schedule interval is five minutes, but delays can occur.

Required repository secrets:

- `DATABASE_URL`
- `DISCORD_WEBHOOK_URL`
- optional authenticated provider URLs or API keys, named in `.env.example`

### 17.2 VPS continuous mode

Use this when low latency, a full validated transaction stream, and reliable continuous ingestion matter.

- `docker-compose.yml` runs `worker` plus PostgreSQL; SQLite may be selected for a single worker only.
- `pnpm scout monitor --continuous` maintains WebSocket subscriptions and gap repair.
- Configure health/readiness endpoints, restart-on-failure, graceful shutdown, a persistent database volume, daily backups, and log rotation.
- Start in backfill/catch-up state; readiness becomes healthy only after the checkpoint reaches the provider's latest validated ledger within the allowed lag.
- The container runs as a non-root user with a read-only filesystem except explicit data/temp paths.

## 18. Logging and operations

Emit newline-delimited JSON logs. Required fields include `timestamp`, `level`, `service`, `version`, `run_id`, `component`, `token_id`, `provider_id`, `ledger_index`, `config_hash`, `model_version`, `event`, and structured error fields when relevant.

Operational events include startup capability results, checkpoint progress, gap detection/repair, request latency, rate-limit/load warning, reconnect, rows written, scoring duration, PPS summary, alert gate decision, delivery result, and clean shutdown.

Never log full webhook/provider credentials or arbitrary raw HTTP headers. Sanitize configured labels and metadata before log or Discord rendering. GitHub Actions writes a concise step summary; VPS mode exposes health metrics including validated-ledger lag, oldest unresolved gap, provider failures, queue depth, score age, and last successful alert delivery.

## 19. Security and abuse resistance

- The application is read-only. Do not include signing, submit, wallet-generation, seed, or private-key dependencies in runtime code.
- Store secrets in GitHub Actions secrets, a VPS secret store, or an untracked `.env`; `.env*` is ignored except `.env.example`.
- Validate provider URLs and allow only `wss:`/`https:` outside explicit local development. Metadata links are displayed only and never fetched server-side.
- Give `GITHUB_TOKEN` minimum permissions; pin third-party Actions to immutable commit SHAs and let Dependabot propose updates.
- Enable secret scanning and dependency review where the GitHub plan permits. Run `pnpm audit` or an equivalent advisory check in CI without making availability depend on registry uptime for every monitor run.
- Escape Discord Markdown and limit untrusted labels/metadata lengths to prevent mentions, spoofed links, or message injection. Disable `@everyone`, role, and user mentions in webhook payloads.
- Encrypt database backups, restrict database network access, rotate a leaked webhook immediately, and document incident steps.
- Treat public ledger addresses/transactions as public data while treating analyst annotations and attribution notes as potentially sensitive.
- Publish the evidence disclaimer in README, reports, and every alert. A high PPS must never be framed as investment advice or certainty.

## 20. Test strategy

### Unit tests

- Currency/issuer tuple matching, hexadecimal currency preservation, XRP drops conversion, and decimal precision.
- Metadata normalization for Payment, OfferCreate/OfferCancel, TrustSet, AMMDeposit, AMMWithdraw, AMMVote, path payments, failed results, and unrelated transactions.
- Robust baseline, missing-baseline behavior, every feature, PPS contributions, thresholds, hysteresis, and fingerprint stability.
- Hub suppression, edge expiry, independent evidence-family counting, cluster sensitivity, and prohibited identity-language templates.
- Config validation including unknown keys, invalid addresses, duplicate IDs, weight sum, impossible thresholds, and secret-shaped values.

### Integration tests

- XRPL adapter with recorded responses, pagination markers, provider range mismatch, rate limiting, reconnect, failover, and gap repair.
- PostgreSQL and SQLite migrations/repository contract, uniqueness, transaction rollback, and locks.
- Discord mock server for `200/204`, `400`, `429`, `500`, timeout, retry, and redaction.
- One-shot worker restart at every checkpoint boundary with no duplicate rows or alerts.

### Replay and historical tests

- Replay a fixed ledger fixture twice and assert byte-equivalent normalized events, features, score, and report except allowed run metadata.
- Assert every feature query respects `as_of_ledger` and cannot see a labeled event's future.
- Exercise event collapsing, matched controls, sample warnings, and incomplete coverage failure.
- Maintain a small golden dataset containing at least one AMM action, DEX trade/offer change, trust-line event, direct funding chain, ambiguous path payment, and no-signal control period.

### CI gates

Every pull request must pass formatting, lint, strict type-check, unit/integration/replay tests, migration checks, build, and secret scan. Critical normalization, scoring, and alert-gate modules require at least 90% branch coverage; the repository overall requires at least 80% branch coverage. Coverage thresholds may only be changed in a reviewed commit explaining why.

## 21. CLI contract

The executable name is `scout`. Commands return non-zero on invalid config, incomplete required history, unresolved migration, source failure without failover, or failed required verification.

```text
scout config validate [--config-dir config/tokens]
scout db migrate
scout providers check
scout discover --token drop
scout backfill --token drop --from-ledger <n> --to-ledger <n|validated>
scout monitor --once [--token drop]
scout monitor --continuous [--token drop]
scout study --token drop --from-ledger <n> --to-ledger <n> --out reports/
scout score --token drop --as-of-ledger <n> [--explain]
scout alert test --token drop --dry-run
scout health
```

`--dry-run` renders a fully redacted message and writes no Discord request or delivered-alert state. A separately named `--send-test` flag may send an unmistakable test message when the webhook secret is present.

## 22. Implementation phases

### Phase 0 — Repository and contracts

Create the repository, toolchain, directory structure, CI, config schema, DROP config, domain types, and empty migrations. Record architecture decisions in the README/docs.

**Complete when:** a fresh clone on Node 24 can install from the lockfile; config validation accepts DROP and rejects deliberately invalid fixtures; formatting, lint, type-check, tests, and build pass locally and in CI.

### Phase 1 — Validated ingestion and persistence

Implement provider capabilities, API v2 requests, live/batch workers, normalization, migrations, checkpoints, gaps, AMM/order-book snapshots, and idempotent replay.

**Complete when:** the golden dataset normalizes correctly; a bounded Mainnet read-only smoke run stores DROP-relevant data; replay creates no duplicates; restart and gap-repair integration tests pass on both database backends.

### Phase 2 — Market and wallet features plus PPS

Implement market state, initial nine features, robust baselines, coverage/freshness, scoring, and explain output.

**Complete when:** every score is reproducible from stored evidence; missing data cannot raise PPS; golden contribution totals match the formula; alert gating remains disabled until quality requirements are met.

### Phase 3 — Historical event study

Implement event labels, collapse logic, matched controls, no-leakage repository bounds, recurrence statistics, backtest metrics, and Markdown/JSON reports.

**Complete when:** a configured complete range produces a deterministic report and an incomplete range fails with exact missing ledgers; leakage, control selection, and small-sample tests pass.

### Phase 4 — Probabilistic wallet graph

Implement funding/behavior edges, hub suppression, evidence families, expiry, clustering, stability analysis, and historical recurring-wallet features.

**Complete when:** each membership can be traced to evidence transactions; exchange/hub fixtures avoid false shared-funder clusters; labels do not propagate; outputs and alerts use approved probabilistic wording.

### Phase 5 — Alerts and production deployment

Implement Discord delivery, retries, deduplication, hysteresis, recovery, structured operations, GitHub Actions batch deployment, and VPS container deployment.

**Complete when:** mocked delivery cases pass; secret values never appear in captured logs/artifacts; overlapping jobs do not duplicate alerts; both deployment paths have tested runbooks and health checks.

### Phase 6 — Calibration and expansion

Run DROP history, review false positives, freeze `pps-v1`, and add a second fixture token entirely through configuration to prove extensibility.

**Complete when:** the time-split backtest and limitations are published; threshold changes create a new model/config version; a second token passes ingestion, scoring, study, and dry-run alert without source changes.

## 23. Acceptance criteria

The project is accepted when all of the following are demonstrated:

1. The canonical GitHub repository is exactly `DegenSoftwareDesigns/xrpl-meme-scout`, `origin` resolves to `https://github.com/DegenSoftwareDesigns/xrpl-meme-scout.git` or its SSH equivalent, its default branch is `main`, and a fresh clone builds reproducibly from the committed lockfile.
2. `drop.yaml` contains exactly currency `44524F5000000000000000000000000000000000` and issuer `rszenFJoDdiGjyezQc8pME9KWDQH43Tswh`; startup logs the derived canonical token key.
3. Adding a second valid token/pair requires only YAML plus secrets/provider capacity, not TypeScript changes.
4. Only validated ledger data can affect stored balances, event labels, PPS, or alerts.
5. Restart, replay, provider failover, overlapping jobs, and Discord retry do not duplicate canonical records or delivered alerts.
6. Every PPS is reproducible and exposes raw inputs, baseline, normalization, contribution, evidence IDs, model version, config hash, coverage, freshness, and as-of ledger.
7. Missing baseline/data contributes zero, lowers coverage, and cannot improve a score or pass an alert gate.
8. Historical studies refuse incomplete required ranges, enforce no-future-data feature queries, use matched controls, and disclose sample size and in-sample/out-of-sample status.
9. Every cluster edge and membership has typed, time-bounded evidence; hub suppression is tested; no output asserts identity/ownership without explicit evidence.
10. Discord alerts respect severity, evidence-family, freshness, gap, cooldown, hysteresis, recovery, dedupe, retry, redaction, and disclaimer rules.
11. The webhook and database credentials exist only in approved secret stores/environment variables and never appear in repository files, logs, artifacts, fixtures, or exception messages.
12. GitHub Actions hourly batch mode works with persistent PostgreSQL, and VPS continuous mode catches up after a simulated disconnect.
13. All CI gates and coverage thresholds pass, including both database repository contracts and deterministic golden replay.
14. `docs/OPERATIONS.md` covers setup, database migrations, backups, provider gaps/rate limits, secret rotation, alert troubleshooting, and rollback.
15. No runtime path contains transaction submission, signing, seed handling, or automated trading capability.
16. After the one-time empty-repository bootstrap, every change reaches `main` through an isolated branch and pull request whose current head passes the green gate defined in Section 25; no merge bypasses repository rules.

## 24. Exact initial setup

The GitHub destination already exists. These steps connect the local project to that exact repository. They do not authorize creating a similarly named repository, changing its owner or visibility, or replacing another remote.

### 24.1 Prerequisites

- Git
- GitHub CLI (`gh`) authenticated to the intended owner
- Node.js 24 LTS
- `pnpm`
- Docker Desktop or Docker Engine for PostgreSQL-backed local integration tests
- A Discord incoming webhook URL, kept out of chat, files, and shell history

Verify:

```sh
git --version
gh auth status
node --version
pnpm --version
docker --version
```

### 24.2 Connect to the canonical repository

Verify authenticated access before writing anything:

```sh
gh auth status
gh repo view DegenSoftwareDesigns/xrpl-meme-scout --json nameWithOwner,url,defaultBranchRef,isPrivate
```

If no local checkout exists, clone the canonical repository:

```sh
git clone https://github.com/DegenSoftwareDesigns/xrpl-meme-scout.git
cd xrpl-meme-scout
git remote -v
git fetch origin --prune
```

If Codex is already inside a checkout or Codex-created worktree, preserve that checkout and inspect it:

```sh
git rev-parse --show-toplevel
git remote get-url origin
git status --short
git branch --show-current
git fetch origin --prune
```

The connection step is complete only when:

- the authenticated repository reports `nameWithOwner` equal to `DegenSoftwareDesigns/xrpl-meme-scout`;
- `origin` is the canonical HTTPS clone URL or the equivalent `git@github.com:DegenSoftwareDesigns/xrpl-meme-scout.git` SSH URL;
- the working tree contains no unaccounted-for user changes; and
- the agent knows whether the repository is empty, on `main`, or already in an isolated Codex worktree branch.

If `origin` is missing, add the canonical URL. If it points anywhere else, stop and report the mismatch; preserve the existing remote and files. If authentication or repository access fails, stop before making local project changes and report the exact failed gate.

### 24.3 Bootstrap the project files

If the repository already contains commits, start the branch workflow in Section 25 and apply Phase 0 there. If it is truly empty, establish `main` once as the bootstrap base; this is the only direct-to-`main` exception.

Initialize `package.json` if it does not exist:

```sh
pnpm init
```

Set `package.json` to `"private": true`, `"type": "module"`, Node engine `>=24 <25`, and a pinned `packageManager`. Create `.node-version` with the chosen Node 24 patch release. Install the initial dependencies:

```sh
pnpm add xrpl decimal.js zod yaml kysely pg better-sqlite3 pino
pnpm add -D typescript tsx vitest @vitest/coverage-v8 eslint prettier @types/node @types/pg @types/better-sqlite3
```

Codex then creates the repository structure, configuration/schema, migrations, documentation stubs, CI workflows, and Phase 0 tests described above. Before any bootstrap commit or pull request, run the green gate:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For a truly empty repository only, review and stage the explicit Phase 0 paths, then establish `main`:

```sh
git status --short
git add -- <explicit-confirmed-phase-0-paths>
git diff --cached --check
git diff --cached
git commit -m "chore: bootstrap xrpl-meme-scout"
git push -u origin main
```

Never expand `<explicit-confirmed-phase-0-paths>` to a blanket add in a mixed worktree. Stage only the files inspected as part of this project. The bootstrap is complete when the remote `main` contains the reviewed commit, a fresh clone passes the green gate, and the default branch is `main`.

Configure a GitHub ruleset for `main` immediately after the bootstrap:

- require changes through pull requests;
- require the current `ci.yml` jobs for formatting, lint, strict type-check, tests, migrations, build, and coverage;
- require the branch to be current with `main` before merge;
- require all review conversations to be resolved;
- preserve linear history and use squash merge;
- block force pushes and branch deletion; and
- grant no routine bypass path to the implementation agent.

If organization policy requires human approval, that approval remains an additional merge gate. The agent must wait for it rather than trying to approve its own change.

### 24.4 Configure secrets without exposing values

Create a PostgreSQL database for production batch mode. Add repository or `production` environment secrets through **GitHub → repository Settings → Secrets and variables → Actions**:

- `DATABASE_URL`
- `DISCORD_WEBHOOK_URL`
- provider credential secrets, only if the selected provider requires them

Alternatively, from an interactive terminal, run each command without placing the value on the command line and paste only at the secret prompt:

```sh
gh secret set DATABASE_URL
gh secret set DISCORD_WEBHOOK_URL
```

Never paste a webhook into an issue, commit, pull request, chat, workflow YAML, token YAML, or command argument.

### 24.5 Bootstrap DROP safely

```sh
pnpm scout config validate --config-dir config/tokens
pnpm scout db migrate
pnpm scout providers check
pnpm scout discover --token drop
pnpm scout alert test --token drop --dry-run
```

Review the discovered AMM account/assets and provider coverage. Choose and record an explicit historical `from_ledger` only after the provider confirms it can serve the complete desired range. Then run a bounded backfill before any live alerting:

```sh
pnpm scout backfill --token drop --from-ledger <confirmed-ledger> --to-ledger validated
pnpm scout study --token drop --from-ledger <confirmed-ledger> --to-ledger <validated-ledger> --out reports/
pnpm scout monitor --once --token drop
```

Inspect the historical report, coverage gaps, score explanation, and dry-run Discord payload. Enable `alerts.enabled` in production only after the evidence wording, thresholds, and false-positive behavior have been reviewed. Send one unmistakable test alert, then enable the hourly workflow or continuous VPS worker.

## 25. Codex repository workflow

This section governs every repository change after the one-time empty-repository bootstrap. It authorizes the implementation agent to create and push scoped branches, open pull requests, repair their checks, and squash-merge them into `main` only after the green gate passes. It does not authorize changing repository ownership/visibility, deleting the repository, rewriting shared history, bypassing rules, publishing releases/packages, rotating secrets, or deploying to production without a separate user request.

The **green gate** is the conjunction of the local validation suite, required GitHub checks, repository rules, review state, current head SHA, and scope review. Green means every mandatory condition below is positively verified; missing or inaccessible evidence is not green.

### 25.1 Synchronize and establish a clean baseline

At the start of each work item:

```sh
gh auth status
git remote get-url origin
git fetch origin --prune
git status --short
git branch --show-current
```

Verify `origin` against the canonical repository. Preserve all pre-existing changes. If the worktree is dirty, identify which files belong to the user or another task; continue only when the new work can be isolated without overwriting or accidentally committing them.

If running in a normal checkout on `main`, update only by fast-forward:

```sh
git switch main
git pull --ff-only origin main
```

If Codex supplied an isolated worktree/branch, preserve it and verify that its merge-base is the intended current `origin/main`; do not switch it to `main`. Before implementation, install from the lockfile and run the repository's full current CI-equivalent suite. Once `package.json` is authoritative, use its scripts rather than stale command copies in this document.

A baseline is complete when the canonical remote, base commit, worktree ownership, and current tests are known. If the baseline is red, record the existing failure before changing code. Repair it in a separate `fix/...` branch when that repair is in scope; otherwise stop and report it rather than mixing an unrelated repair into a feature.

### 25.2 Isolate one work item per branch

Create a branch from updated `main` unless the Codex task already supplied a correctly based isolated branch:

```sh
git switch -c feat/<short-kebab-description>
```

Use `feat/`, `fix/`, `chore/`, `docs/`, `test/`, or `refactor/` according to the primary change. One branch and pull request contain one coherent outcome. Independent features use independent branches after their prerequisite changes have merged. A branch is ready for implementation when its base is recorded, its scope is one sentence, and unrelated working-tree changes remain outside it.

### 25.3 Implement with evidence and coherent commits

For behavior changes, add or update tests in the same branch. Keep architecture/config/docs synchronized with the code they govern. Inspect the diff throughout the work:

```sh
git status --short
git diff -- <changed-paths>
```

Commit at coherent, reviewable boundaries: a commit must build toward the branch outcome, keep tests with the behavior they validate, and avoid unrelated formatting churn. Use Conventional Commits, for example:

```text
feat(ingestion): resume from validated ledger checkpoints
test(scoring): cover missing-baseline contributions
docs(operations): document Discord secret rotation
```

Stage only inspected paths:

```sh
git add -- <confirmed-path-1> <confirmed-path-2>
git diff --cached --check
git diff --cached
git commit -m "<type>(<scope>): <imperative summary>"
```

The commit step is complete when every staged line belongs to the work item, credentials and generated artifacts are absent, tests relevant to that commit pass, and the remaining worktree state is understood.

### 25.4 Run the local green gate

Before opening or updating a ready-for-review pull request, run all current repository gates. Initially they are:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run migration validation, replay/golden tests, database integration tests, coverage thresholds, Docker smoke tests, or security checks whenever the repository's CI or the touched area requires them. Documentation-only changes still run the mandatory repository suite unless CI explicitly defines a narrower docs path.

The local gate is complete only at the exact commit intended for push, with every mandatory command successful and the worktree free of uncommitted changes belonging to the work item. Record command names and outcomes for the pull request; never claim a test was run when it was skipped or unavailable.

### 25.5 Push and open a pull request

Push only the isolated branch:

```sh
git push -u origin <branch-name>
gh pr create --repo DegenSoftwareDesigns/xrpl-meme-scout --base main --head <branch-name> --draft
```

Reuse an existing open pull request for the same branch rather than creating a duplicate. Its description must contain:

- the outcome and reason;
- scoped implementation notes;
- tests executed with results;
- data/migration/security impact;
- risks, limitations, and rollback path; and
- screenshots or evidence only when they materially verify behavior.

Mark the pull request ready only after the local green gate passes. Then wait for the required GitHub checks. A failure is repaired on the same branch with a scoped commit and a fresh local gate; unrelated follow-up work receives another branch.

### 25.6 Merge only on a verified current head

Immediately before merging, re-read the pull request and verify all of these against its current head SHA:

1. The PR is open, ready for review, targets `main`, and contains only the intended work.
2. The head SHA equals the commit that passed the local green gate; no unvalidated commit was pushed afterward.
3. Every required GitHub check is complete and successful. Mandatory tests are never pending, skipped unexpectedly, cancelled, stale, or inaccessible.
4. GitHub reports the PR mergeable with no conflicts and, where configured, current with `main`.
5. No review is in “changes requested”; every required approval and conversation-resolution rule is satisfied.
6. Coverage and migration/replay gates meet Section 20, and secrets/security scanning reports no unresolved finding.
7. The PR describes known limitations and contains no unrelated files, credential material, or unexplained generated output.

When every condition remains green, squash-merge through the normal repository rules and delete the remote feature branch. Bind the merge to the verified head SHA when the available GitHub tool supports an expected-head precondition. Never use an administrator bypass or force merge.

After merging, update a normal checkout:

```sh
git switch main
git pull --ff-only origin main
git fetch origin --prune
```

In a Codex-created worktree where `main` is checked out elsewhere, keep the isolated task branch, run `git fetch origin --prune`, and verify `origin/main` directly instead of trying to take over the other worktree's branch.

Confirm the PR is recorded as merged, `origin/main` contains the result, post-merge CI is green, and the remote feature branch is deleted. A merge is complete only after those four facts are verified. Start the next independent feature from a refreshed `main`.

### 25.7 Red-gate behavior

Any failed, pending, conflicting, stale, inaccessible, or ambiguous mandatory condition makes the gate red. Keep the PR open—draft if substantial work remains—diagnose and repair in its branch, or report the blocker. Preserve evidence and user work. The agent may not weaken tests, lower coverage, rewrite history, change branch rules, self-approve, or use privileged bypasses to turn a red gate green.

## 26. Official technical references

- [XRPL currency formats](https://xrpl.org/docs/references/protocol/data-types/currency-formats)
- [XRPL trust-line tokens](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens)
- [XRPL `subscribe`](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe)
- [XRPL `account_tx`](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_tx)
- [XRPL `amm_info`](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/path-and-order-book-methods/amm_info)
- [XRPL `book_offers`](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/path-and-order-book-methods/book_offers)
- [XRPL API rate limiting](https://xrpl.org/docs/references/http-websocket-apis/api-conventions/rate-limiting)
- [`xrpl.js` `getBalanceChanges`](https://js.xrpl.org/functions/getBalanceChanges.html)
- [Discord incoming webhooks](https://docs.discord.com/developers/platform/webhooks)
- [Discord webhook resource and execution](https://docs.discord.com/developers/resources/webhook)
- [GitHub Actions workflow syntax and scheduled runs](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)

---

**Implementation rule:** when the ledger, provider, or evidence is incomplete, represent uncertainty in data and language. The system succeeds by making precursor evidence auditable—not by turning a heuristic into a claim.
