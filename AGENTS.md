# Repository instructions

Read `XRPL_MEME_SCOUT_PROJECT_SPEC.md` before changing architecture, data semantics, configuration, scoring, alerts, deployment, or repository workflow. Section 25 governs branches, evidence, green gates, and merges.

Treat `src/config/token-schema.ts` and `config/schema/token.schema.json` as one configuration contract. After schema changes, run `pnpm config:schema` and commit the generated schema with its tests and documentation.

Preserve the current read-only product boundary: runtime code observes validated XRPL data and carries no signing, submission, seed, private-key, custody, or automated-execution path. Represent incomplete evidence as unavailable data with explicit coverage, never as certainty.

Use exact `(network, issuer, currency)` tuples for issued assets and decimal-safe values for money. Keep normalization and scoring deterministic, evidence-linked, and bounded by `as_of_ledger`.

Before declaring repository work complete, use the scripts in `package.json` as the command source and pass formatting, lint, strict type-check, tests with coverage, migration validation, and build. Preserve user changes and stage only reviewed paths.
