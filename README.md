# xrpl-meme-scout

Evidence-based XRPL memecoin surveillance for precursor wallet activity, liquidity changes, and possible coordinated pump preparation.

[![Repository](https://img.shields.io/badge/GitHub-DegenSoftwareDesigns%2Fxrpl--meme--scout-181717?logo=github)](https://github.com/DegenSoftwareDesigns/xrpl-meme-scout)

> **Project status: early development.** The [project specification](./XRPL_MEME_SCOUT_PROJECT_SPEC.md) defines the implementation contract and delivery phases. Features and commands described below become available as their corresponding phases land.

`xrpl-meme-scout` is a read-only monitoring and research system. It analyzes validated XRP Ledger data, compares current behavior with historical precursor windows, calculates an explainable **Pump Precursor Score**, and can send evidence summaries to Discord.

It does **not** trade, sign transactions, hold wallet secrets, identify wallet owners, or prove manipulation.

## Why this exists

Thin liquidity can let a relatively small amount of coordinated capital move a memecoin market. Supply and issuer-level facts alone do not explain who controls the tradable float or whether a recurring set of addresses tends to become active before large moves.

This project focuses on auditable questions:

- Are newly funded wallets accumulating the token?
- Are behaviorally linked addresses acting within unusually tight time windows?
- Is AMM or sell-side DEX liquidity becoming thinner?
- Are addresses seen before previous rallies active again?
- Does current activity differ materially from the token's own rolling baseline?

Every score keeps its supporting transactions, feature values, baseline, data coverage, and model/config versions.

## Initial asset: DROP

The first monitored asset is DROP on XRPL Mainnet.

| Field          | Value                                       |
| -------------- | ------------------------------------------- |
| Symbol         | `DROP`                                      |
| Currency       | `44524F5000000000000000000000000000000000`  |
| Issuer         | `rszenFJoDdiGjyezQc8pME9KWDQH43Tswh`        |
| Primary market | DROP/XRP                                    |
| Venues         | XRPL AMM and both DEX order-book directions |

The canonical asset identity is `(network, issuer, currency)`. The display symbol alone is never used to match ledger data.

Additional tokens are added through validated YAML configuration: issuer, currency code, symbol, markets/AMMs, known wallet annotations, thresholds, scoring weights, and metadata. Adding a token must not require application-code changes.

## How it works

```text
XRPL validated ledgers and subscriptions
                  │
                  ▼
        canonical normalization
                  │
                  ▼
       idempotent SQL persistence
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
  market state  wallet graph  historical events
       └──────────┼──────────┘
                  ▼
          precursor features
                  ▼
        Pump Precursor Score
                  ▼
      quality gates and dedupe
                  ▼
          Discord webhook
```

The system supports two runtime modes:

| Mode                 | Best for                                        | Persistence                                         |
| -------------------- | ----------------------------------------------- | --------------------------------------------------- |
| GitHub Actions batch | Low-operations hourly monitoring                | External PostgreSQL required                        |
| VPS continuous       | Low-latency WebSocket monitoring and gap repair | PostgreSQL recommended; SQLite for one local worker |

GitHub Actions artifacts and caches are not treated as the authoritative mutable database.

## Pump Precursor Score

PPS is an explainable anomaly/evidence index from `0` to `100`; it is not a probability that a pump will happen.

Initial feature families include:

| Feature                       | Signal                                                          |
| ----------------------------- | --------------------------------------------------------------- |
| Newly funded buyers           | Wallets receive XRP and then acquire the token                  |
| Coordinated accumulation      | Unusual buy imbalance and synchronized acquisition              |
| Common funding evidence       | Non-hub shared funding or short funding paths                   |
| Liquidity withdrawal          | AMM reserve or executable-depth reduction                       |
| Sell-side depth thinning      | Decline in funded token offers at configured notionals          |
| Quiet-price buy pressure      | Strong accumulation with muted price response                   |
| Repeat precursor wallets      | Addresses recur before independently labeled historical events  |
| Trust-line creation burst     | Unusual creation and activation of relevant trust lines         |
| Holder concentration increase | Coverage-adjusted concentration among observed wallets/clusters |

```text
PPS = round(100 × Σ(feature weight × normalized signal))
```

Missing data contributes zero and lowers a separate coverage score. An alert requires sufficient coverage, fresh validated ledgers, multiple independent evidence families, no overlapping data gap, and a score above the configured threshold.

## Wallet clustering policy

Wallet clustering is probabilistic and evidence-based. A graph edge or cluster represents the strength of an on-ledger behavioral association under named heuristics—not proof of ownership, identity, inside information, or illegal coordination.

The implementation must:

- retain the transactions and calculations supporting every association;
- suppress or penalize shared-funder links involving exchanges, faucets, market makers, and other hubs;
- require independent evidence families for high association;
- keep analyst labels attached only to the address they describe; and
- use language such as “behaviorally linked addresses,” including limitations and counter-evidence.

## Configuration

Token files live in `config/tokens/`. The initial DROP configuration follows this shape:

```yaml
schema_version: 1

token:
  id: drop
  enabled: true
  network: mainnet
  symbol: DROP
  issuer: rszenFJoDdiGjyezQc8pME9KWDQH43Tswh
  currency: "44524F5000000000000000000000000000000000"

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
      - type: dex_order_book
        directions: both

alerts:
  enabled: false
  destination: discord
  webhook_env: DISCORD_WEBHOOK_URL
```

The complete schema, thresholds, weights, and extensibility rules are in the [project specification](./XRPL_MEME_SCOUT_PROJECT_SPEC.md#8-token-configuration-contract).

Secrets and provider credentials never belong in token YAML.

## Quick start

### Prerequisites

- Git and an authenticated GitHub CLI
- Node.js 24 LTS
- `pnpm`
- Docker for PostgreSQL-backed integration tests
- An XRPL provider with the ledger range required by the intended task
- An optional Discord incoming webhook for alerts

### Clone and install

```sh
git clone https://github.com/DegenSoftwareDesigns/xrpl-meme-scout.git
cd xrpl-meme-scout
pnpm install --frozen-lockfile
```

### Configure the environment

Copy `.env.example` to an untracked `.env` for local development. At minimum, configure the database and XRPL provider values documented in that file. Add `DISCORD_WEBHOOK_URL` only when testing or enabling Discord delivery.

For GitHub Actions, create secrets interactively so their values do not enter shell history:

```sh
gh secret set DATABASE_URL
gh secret set DISCORD_WEBHOOK_URL
```

Never paste the webhook into source files, YAML configuration, issues, pull requests, chats, or command arguments.

### Validate and bootstrap

```sh
pnpm scout config validate --config-dir config/tokens
pnpm scout db migrate
pnpm scout providers check
pnpm scout discover --token drop
pnpm scout alert test --token drop --dry-run
```

Confirm the provider's complete ledger range before selecting a historical start ledger. A full event study must fail visibly when required history is incomplete.

### Run

One scheduled-style cycle:

```sh
pnpm scout monitor --once --token drop
```

Continuous VPS worker:

```sh
pnpm scout monitor --continuous --token drop
```

Historical study:

```sh
pnpm scout study \
  --token drop \
  --from-ledger <confirmed-ledger> \
  --to-ledger <validated-ledger> \
  --out reports/
```

Alerts start disabled. Enable them only after reviewing historical coverage, false-positive behavior, score explanations, and a dry-run Discord payload.

## CLI

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

## Data integrity and limitations

- Scores and alerts use validated ledger data only.
- Public XRPL servers may rate-limit clients and may not retain the requested history.
- Issuer transaction history does not enumerate every third-party transfer or trade for an issued token.
- Complete historical event studies require a full-history provider, archive, or previously indexed dataset.
- “Observed holders” and concentration metrics always disclose coverage.
- Historical recurrence can overfit small samples; reports include sample size and in-sample/out-of-sample status.
- A high PPS is compatible with several benign explanations and does not guarantee future price movement.

## Development

The initial quality gate is:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI also validates migrations, deterministic replay, database contracts, coverage, and secret safety as those phases land. Critical normalization, scoring, and alert-gate modules target at least 90% branch coverage; the repository target is at least 80%.

## Contributing

All changes after the one-time empty-repository bootstrap use an isolated branch and pull request:

1. Synchronize with `origin/main` and prove the baseline is green.
2. Use one `feat/...`, `fix/...`, `docs/...`, or equivalent branch per coherent outcome.
3. Keep tests with the behavior they validate and use Conventional Commits.
4. Open a draft PR, record the commands actually run, and wait for required CI.
5. Squash-merge only when the current head SHA passes every local and remote gate, has no unresolved review or conflict, and complies with repository rules.

The authoritative Codex/Git workflow—including worktree handling, red-gate behavior, and merge conditions—is in [Section 25 of the project specification](./XRPL_MEME_SCOUT_PROJECT_SPEC.md#25-codex-repository-workflow).

## Roadmap

- [x] Repository contracts, DROP config, schema, CI, and domain types
- [ ] Validated XRPL ingestion, persistence, checkpoints, and gap repair
- [ ] Market/wallet features and PPS v1
- [ ] Historical event study and time-split backtesting
- [ ] Probabilistic wallet graph with hub suppression
- [ ] Discord alerts and production deployments
- [ ] PPS calibration and a second token added entirely through configuration

See [implementation phases](./XRPL_MEME_SCOUT_PROJECT_SPEC.md#22-implementation-phases) and [acceptance criteria](./XRPL_MEME_SCOUT_PROJECT_SPEC.md#23-acceptance-criteria) for the checkable definition of done.

## Security

Report security issues privately to the repository owner rather than opening a public issue containing credentials or exploitable details. Rotate an exposed Discord webhook or provider credential immediately.

The runtime is intentionally read-only and must not contain XRPL signing, transaction submission, seed handling, private-key handling, or automated trading paths.

## References

- [Project specification](./XRPL_MEME_SCOUT_PROJECT_SPEC.md)
- [XRPL documentation](https://xrpl.org/docs/)
- [XRPL currency formats](https://xrpl.org/docs/references/protocol/data-types/currency-formats)
- [XRPL subscriptions](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe)
- [Discord incoming webhooks](https://docs.discord.com/developers/platform/webhooks)

## Disclaimer

`xrpl-meme-scout` provides heuristic on-ledger surveillance for research and operational monitoring. Its outputs are not proof of ownership, identity, coordination, manipulation, fraud, or future price movement. Nothing produced by this project is financial, investment, or legal advice.
