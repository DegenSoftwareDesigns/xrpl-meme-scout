# Pump Precursor Score

PPS is a versioned anomaly and evidence index from 0 to 100. It is not a probability, trading instruction, or claim of manipulation.

## Version 1 feature weights

| Feature                       | Weight |
| ----------------------------- | -----: |
| Newly funded buyers           |   0.15 |
| Coordinated accumulation      |   0.18 |
| Common funding evidence       |   0.15 |
| Liquidity withdrawal          |   0.12 |
| Sell-side depth thinning      |   0.08 |
| Quiet-price buy pressure      |   0.07 |
| Repeat precursor wallets      |   0.15 |
| Trust-line creation burst     |   0.05 |
| Holder concentration increase |   0.05 |

For each configured window, a directional raw feature is compared with its own rolling baseline. Skewed non-negative values use `log1p` where documented. Robust normalization uses the median and median absolute deviation:

```text
robust_z = (transformed_value - median) / (1.4826 × MAD + epsilon)
signal   = clamp((robust_z - warn_z) / (critical_z - warn_z), 0, 1)
PPS      = round(100 × Σ(weight × signal))
```

Every contribution retains its raw input, baseline, normalized signal, weight, evidence identifiers, config hash, model version, as-of ledger, freshness, coverage, and any unavailability reason.

Unavailable data contributes zero and reduces `coverage_ratio`; weights are not rebalanced. This makes missing data incapable of raising PPS. Alert eligibility additionally requires fresh validated ledgers, no overlapping gap, enough coverage, independent evidence families, and deduplication/hysteresis checks.

Scoring is scheduled for Phase 2. Until then, this document records the contract rather than an available runtime feature.
