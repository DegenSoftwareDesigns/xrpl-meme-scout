import { z } from "zod";

import {
  XRPL_NETWORKS,
  isClassicAddress,
  isIssuedCurrency,
  type IssuedAsset,
} from "../domain/assets.js";

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;
const VERSION_PATTERN = /^[a-z][a-z0-9_-]*$/;
const ENVIRONMENT_VARIABLE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const CLASSIC_ADDRESS_PATTERN = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const CURRENCY_PATTERN = /^(?:[!-~]{3}|[0-9A-Fa-f]{40})$/;

const identifierSchema = z.string().min(1).max(64).regex(IDENTIFIER_PATTERN);
const positiveIntegerSchema = z.number().int().positive();
const nonNegativePercentageSchema = z.number().min(0).max(100);
const ratioSchema = z.number().min(0).max(1);
const classicAddressSchema = z
  .string()
  .regex(CLASSIC_ADDRESS_PATTERN, "must look like an XRPL classic address")
  .refine(isClassicAddress, "must be a valid XRPL classic address");
const currencySchema = z
  .string()
  .regex(CURRENCY_PATTERN, "must be a 3-character or 40-character hexadecimal currency")
  .refine(isIssuedCurrency, "must be a valid issued currency other than XRP");

const uniquePositiveIntegers = z
  .array(positiveIntegerSchema)
  .min(1)
  .refine((values) => new Set(values).size === values.length, "must contain unique values");

export const XrpAssetSchema = z.object({ type: z.literal("xrp") }).strict();

export const IssuedAssetSchema = z
  .object({
    type: z.literal("issued"),
    issuer: classicAddressSchema,
    currency: currencySchema,
  })
  .strict();

export const AssetSchema = z.discriminatedUnion("type", [XrpAssetSchema, IssuedAssetSchema]);

const attributionSchema = z
  .object({
    status: z.enum(["protocol_fact", "analyst_annotation", "external_evidence"]),
    source: z.string().min(1).max(120),
    note: z.string().min(1).max(500),
  })
  .strict();

const knownWalletSchema = z
  .object({
    address: classicAddressSchema,
    labels: z.array(identifierSchema).min(1),
    role_hint: identifierSchema.optional(),
    valid_from: z.iso.datetime({ offset: true }).optional(),
    valid_to: z.iso.datetime({ offset: true }).optional(),
    attribution: attributionSchema,
  })
  .strict()
  .superRefine((wallet, context) => {
    if (
      wallet.valid_from !== undefined &&
      wallet.valid_to !== undefined &&
      Date.parse(wallet.valid_from) >= Date.parse(wallet.valid_to)
    ) {
      context.addIssue({
        code: "custom",
        message: "valid_from must be earlier than valid_to",
        path: ["valid_to"],
      });
    }

    if (new Set(wallet.labels).size !== wallet.labels.length) {
      context.addIssue({ code: "custom", message: "labels must be unique", path: ["labels"] });
    }
  });

const ammVenueSchema = z
  .object({
    type: z.literal("amm"),
    discover: z.boolean(),
    amm_account: classicAddressSchema.nullable(),
  })
  .strict()
  .superRefine((venue, context) => {
    if (!venue.discover && venue.amm_account === null) {
      context.addIssue({
        code: "custom",
        message: "amm_account is required when AMM discovery is disabled",
        path: ["amm_account"],
      });
    }
  });

const dexVenueSchema = z
  .object({
    type: z.literal("dex_order_book"),
    directions: z.enum(["both", "base_to_quote", "quote_to_base"]),
  })
  .strict();

const marketSchema = z
  .object({
    id: identifierSchema,
    base: AssetSchema,
    quote: AssetSchema,
    venues: z.array(z.discriminatedUnion("type", [ammVenueSchema, dexVenueSchema])).min(1),
    depth_notional_xrp: uniquePositiveIntegers,
  })
  .strict()
  .superRefine((market, context) => {
    if (JSON.stringify(market.base) === JSON.stringify(market.quote)) {
      context.addIssue({ code: "custom", message: "base and quote assets must differ" });
    }

    const venueTypes = market.venues.map((venue) => venue.type);
    if (new Set(venueTypes).size !== venueTypes.length) {
      context.addIssue({ code: "custom", message: "venue types must be unique", path: ["venues"] });
    }
  });

const featureWeightsSchema = z
  .record(identifierSchema, ratioSchema)
  .refine((weights) => Object.keys(weights).length > 0, "at least one feature weight is required")
  .refine(
    (weights) =>
      Math.abs(Object.values(weights).reduce((sum, weight) => sum + weight, 0) - 1) <= 1e-9,
    "feature weights must sum to 1.0 within a tolerance of 1e-9",
  );

export const TokenConfigSchema = z
  .object({
    schema_version: z.literal(1),
    token: z
      .object({
        id: identifierSchema,
        enabled: z.boolean(),
        network: z.enum(XRPL_NETWORKS),
        symbol: z.string().min(1).max(32),
        name: z.string().min(1).max(100),
        issuer: classicAddressSchema,
        currency: currencySchema,
        metadata: z
          .object({
            tags: z.array(identifierSchema),
            description: z.string().max(500),
            links: z.array(z.url({ protocol: /^https?$/ })).max(20),
          })
          .strict(),
      })
      .strict(),
    history: z
      .object({
        from_ledger: positiveIntegerSchema.nullable(),
        to_ledger: z.union([positiveIntegerSchema, z.literal("validated")]),
        require_complete_range_for_event_study: z.boolean(),
        raw_retention_days: positiveIntegerSchema,
      })
      .strict(),
    markets: z.array(marketSchema).min(1),
    known_wallets: z.array(knownWalletSchema),
    analysis: z
      .object({
        windows_minutes: uniquePositiveIntegers,
        baseline_days: positiveIntegerSchema,
        minimum_baseline_samples: positiveIntegerSchema,
        precursor_windows_hours: uniquePositiveIntegers,
        pump_event: z
          .object({
            forward_horizon_hours: positiveIntegerSchema,
            minimum_token_xrp_return_pct: nonNegativePercentageSchema,
            minimum_quote_volume_xrp: z.number().positive(),
            collapse_gap_hours: positiveIntegerSchema,
          })
          .strict(),
        graph: z
          .object({
            funding_lookback_hours: positiveIntegerSchema,
            synchronized_action_minutes: positiveIntegerSchema,
            max_funding_hops: z.number().int().min(1).max(10),
            hub_unique_counterparties_30d: positiveIntegerSchema,
            minimum_cluster_edge_score: ratioSchema,
          })
          .strict(),
      })
      .strict(),
    score: z
      .object({
        version: z.string().min(1).max(64).regex(VERSION_PATTERN),
        warn_robust_z: z.number(),
        critical_robust_z: z.number(),
        features: featureWeightsSchema,
      })
      .strict(),
    alerts: z
      .object({
        enabled: z.boolean(),
        destination: z.literal("discord"),
        webhook_env: z.string().regex(ENVIRONMENT_VARIABLE_PATTERN),
        minimum_score: z.number().int().min(0).max(100),
        levels: z
          .object({
            elevated: z.number().int().min(0).max(100),
            high: z.number().int().min(0).max(100),
            critical: z.number().int().min(0).max(100),
          })
          .strict(),
        minimum_feature_families: positiveIntegerSchema,
        minimum_data_coverage_ratio: ratioSchema,
        maximum_data_age_seconds: positiveIntegerSchema,
        cooldown_minutes: positiveIntegerSchema,
        realert_score_increase: positiveIntegerSchema.max(100),
        recovery_below_score: z.number().int().min(0).max(100),
      })
      .strict(),
  })
  .strict()
  .superRefine((config, context) => {
    const marketIds = config.markets.map((market) => market.id);
    if (new Set(marketIds).size !== marketIds.length) {
      context.addIssue({ code: "custom", message: "market IDs must be unique", path: ["markets"] });
    }

    const walletAddresses = config.known_wallets.map((wallet) => wallet.address);
    if (new Set(walletAddresses).size !== walletAddresses.length) {
      context.addIssue({
        code: "custom",
        message: "known wallet addresses must be unique",
        path: ["known_wallets"],
      });
    }

    const tokenAsset: IssuedAsset = {
      type: "issued",
      issuer: config.token.issuer,
      currency: config.token.currency,
    };

    for (const [marketIndex, market] of config.markets.entries()) {
      const assets = [market.base, market.quote];
      const containsToken = assets.some(
        (asset) =>
          asset.type === "issued" &&
          asset.issuer === tokenAsset.issuer &&
          asset.currency === tokenAsset.currency,
      );

      if (!containsToken) {
        context.addIssue({
          code: "custom",
          message: "each market must contain the configured token tuple",
          path: ["markets", marketIndex],
        });
      }
    }

    if (config.history.from_ledger !== null && typeof config.history.to_ledger === "number") {
      if (config.history.from_ledger > config.history.to_ledger) {
        context.addIssue({
          code: "custom",
          message: "from_ledger must not exceed to_ledger",
          path: ["history", "from_ledger"],
        });
      }
    }

    if (config.score.warn_robust_z >= config.score.critical_robust_z) {
      context.addIssue({
        code: "custom",
        message: "warn_robust_z must be lower than critical_robust_z",
        path: ["score"],
      });
    }

    const { elevated, high, critical } = config.alerts.levels;
    if (!(elevated < high && high < critical)) {
      context.addIssue({
        code: "custom",
        message: "alert levels must increase from elevated to high to critical",
        path: ["alerts", "levels"],
      });
    }

    if (config.alerts.minimum_score !== elevated) {
      context.addIssue({
        code: "custom",
        message: "minimum_score must equal the elevated alert level",
        path: ["alerts", "minimum_score"],
      });
    }

    if (config.alerts.recovery_below_score >= config.alerts.minimum_score) {
      context.addIssue({
        code: "custom",
        message: "recovery_below_score must be lower than minimum_score",
        path: ["alerts", "recovery_below_score"],
      });
    }
  });

export type TokenConfig = z.infer<typeof TokenConfigSchema>;
