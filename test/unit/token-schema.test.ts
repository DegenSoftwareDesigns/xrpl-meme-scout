import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { beforeAll, describe, expect, it } from "vitest";

import { TokenConfigSchema, type TokenConfig } from "../../src/config/token-schema.js";

let validDocument: Record<string, unknown>;

beforeAll(async () => {
  const yaml = await readFile(path.join(process.cwd(), "config", "tokens", "drop.yaml"), "utf8");
  validDocument = parse(yaml) as Record<string, unknown>;
});

function cloneValidDocument(): Record<string, unknown> {
  return structuredClone(validDocument);
}

function score(document: Record<string, unknown>): Record<string, unknown> {
  return document["score"] as Record<string, unknown>;
}

function alerts(document: Record<string, unknown>): Record<string, unknown> {
  return document["alerts"] as Record<string, unknown>;
}

function firstKnownWallet(document: Record<string, unknown>): Record<string, unknown> {
  const wallet = (document["known_wallets"] as Record<string, unknown>[])[0];
  if (wallet === undefined) {
    throw new Error("Expected the canonical configuration to contain a known wallet");
  }
  return wallet;
}

function firstMarket(document: Record<string, unknown>): Record<string, unknown> {
  const market = (document["markets"] as Record<string, unknown>[])[0];
  if (market === undefined) {
    throw new Error("Expected the canonical configuration to contain a market");
  }
  return market;
}

function firstVenue(document: Record<string, unknown>): Record<string, unknown> {
  const venue = (firstMarket(document)["venues"] as Record<string, unknown>[])[0];
  if (venue === undefined) {
    throw new Error("Expected the canonical configuration to contain a venue");
  }
  return venue;
}

describe("token configuration schema", () => {
  it("accepts the canonical DROP configuration", () => {
    const result = TokenConfigSchema.safeParse(cloneValidDocument());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toMatchObject({
        currency: "44524F5000000000000000000000000000000000",
        issuer: "rszenFJoDdiGjyezQc8pME9KWDQH43Tswh",
      });
    }
  });

  it("rejects unknown keys at every strict object boundary", () => {
    const document = cloneValidDocument();
    document["unexpected"] = true;
    const result = TokenConfigSchema.safeParse(document);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
    }
  });

  it("rejects invalid XRPL addresses", () => {
    const document = cloneValidDocument();
    (document["token"] as Record<string, unknown>)["issuer"] = "rNotARealAddress";
    expect(TokenConfigSchema.safeParse(document).success).toBe(false);
  });

  it("accepts forward or open-ended wallet validity and rejects reversed windows", () => {
    const openEndedDocument = cloneValidDocument();
    firstKnownWallet(openEndedDocument)["valid_from"] = "2026-01-01T00:00:00Z";
    expect(TokenConfigSchema.safeParse(openEndedDocument).success).toBe(true);

    const forwardDocument = cloneValidDocument();
    firstKnownWallet(forwardDocument)["valid_from"] = "2026-01-01T00:00:00Z";
    firstKnownWallet(forwardDocument)["valid_to"] = "2026-01-02T00:00:00Z";
    expect(TokenConfigSchema.safeParse(forwardDocument).success).toBe(true);

    const reversedDocument = cloneValidDocument();
    firstKnownWallet(reversedDocument)["valid_from"] = "2026-01-02T00:00:00Z";
    firstKnownWallet(reversedDocument)["valid_to"] = "2026-01-01T00:00:00Z";
    const result = TokenConfigSchema.safeParse(reversedDocument);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ message: "valid_from must be earlier than valid_to" }),
      );
    }
  });

  it("rejects duplicate labels on a known wallet", () => {
    const document = cloneValidDocument();
    firstKnownWallet(document)["labels"] = ["issuer", "issuer"];
    const result = TokenConfigSchema.safeParse(document);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ message: "labels must be unique" }),
      );
    }
  });

  it("requires an AMM account only when discovery is disabled", () => {
    const explicitDocument = cloneValidDocument();
    firstVenue(explicitDocument)["discover"] = false;
    firstVenue(explicitDocument)["amm_account"] = "rszenFJoDdiGjyezQc8pME9KWDQH43Tswh";
    expect(TokenConfigSchema.safeParse(explicitDocument).success).toBe(true);

    const missingDocument = cloneValidDocument();
    firstVenue(missingDocument)["discover"] = false;
    const result = TokenConfigSchema.safeParse(missingDocument);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: "amm_account is required when AMM discovery is disabled",
        }),
      );
    }
  });

  it("rejects a market whose base and quote assets are identical", () => {
    const document = cloneValidDocument();
    firstMarket(document)["quote"] = structuredClone(firstMarket(document)["base"]);
    const result = TokenConfigSchema.safeParse(document);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ message: "base and quote assets must differ" }),
      );
    }
  });

  it("rejects duplicate venue types within one market", () => {
    const document = cloneValidDocument();
    const venues = firstMarket(document)["venues"] as Record<string, unknown>[];
    venues.push(structuredClone(firstVenue(document)));
    const result = TokenConfigSchema.safeParse(document);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ message: "venue types must be unique" }),
      );
    }
  });

  it("rejects duplicate known-wallet addresses", () => {
    const document = cloneValidDocument();
    const wallets = document["known_wallets"] as Record<string, unknown>[];
    wallets.push(structuredClone(firstKnownWallet(document)));
    const result = TokenConfigSchema.safeParse(document);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ message: "known wallet addresses must be unique" }),
      );
    }
  });

  it("accepts open or ascending ledger ranges and rejects descending ranges", () => {
    const openDocument = cloneValidDocument();
    (openDocument["history"] as Record<string, unknown>)["from_ledger"] = 100;
    expect(TokenConfigSchema.safeParse(openDocument).success).toBe(true);

    const ascendingDocument = cloneValidDocument();
    (ascendingDocument["history"] as Record<string, unknown>)["from_ledger"] = 100;
    (ascendingDocument["history"] as Record<string, unknown>)["to_ledger"] = 200;
    expect(TokenConfigSchema.safeParse(ascendingDocument).success).toBe(true);

    const descendingDocument = cloneValidDocument();
    (descendingDocument["history"] as Record<string, unknown>)["from_ledger"] = 200;
    (descendingDocument["history"] as Record<string, unknown>)["to_ledger"] = 100;
    const result = TokenConfigSchema.safeParse(descendingDocument);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ message: "from_ledger must not exceed to_ledger" }),
      );
    }
  });

  it("rejects duplicate market IDs and missing token tuples", () => {
    const duplicateDocument = cloneValidDocument();
    const markets = duplicateDocument["markets"] as Record<string, unknown>[];
    const originalMarket = markets[0];
    expect(originalMarket).toBeDefined();
    if (originalMarket !== undefined) {
      markets.push(structuredClone(originalMarket));
    }
    expect(TokenConfigSchema.safeParse(duplicateDocument).success).toBe(false);

    const missingTupleDocument = cloneValidDocument();
    const firstMarket = (missingTupleDocument["markets"] as Record<string, unknown>[])[0];
    const base = firstMarket?.["base"] as Record<string, unknown>;
    base["currency"] = "USD";
    expect(TokenConfigSchema.safeParse(missingTupleDocument).success).toBe(false);
  });

  it("requires feature weights to sum to exactly one within tolerance", () => {
    const document = cloneValidDocument();
    const features = score(document)["features"] as Record<string, number>;
    features["newly_funded_buyers"] = 0.16;
    const result = TokenConfigSchema.safeParse(document);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("sum to 1.0"))).toBe(true);
    }
  });

  it("rejects impossible score and alert thresholds", () => {
    const scoreDocument = cloneValidDocument();
    score(scoreDocument)["warn_robust_z"] = 5;
    expect(TokenConfigSchema.safeParse(scoreDocument).success).toBe(false);

    const alertDocument = cloneValidDocument();
    (alerts(alertDocument)["levels"] as Record<string, number>)["high"] = 50;
    alerts(alertDocument)["recovery_below_score"] = 60;
    expect(TokenConfigSchema.safeParse(alertDocument).success).toBe(false);
  });

  it("requires the minimum alert score to equal the elevated level", () => {
    const document = cloneValidDocument();
    alerts(document)["minimum_score"] = 61;
    const result = TokenConfigSchema.safeParse(document);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ message: "minimum_score must equal the elevated alert level" }),
      );
    }
  });

  it("accepts only an environment variable name for the Discord webhook", () => {
    const document = cloneValidDocument();
    alerts(document)["webhook_env"] = "https://discord.example/webhook/secret";
    expect(TokenConfigSchema.safeParse(document).success).toBe(false);
  });

  it("exposes a strict inferred TypeScript contract", () => {
    const config: TokenConfig = TokenConfigSchema.parse(cloneValidDocument());
    expect(config.schema_version).toBe(1);
    expect(config.alerts.enabled).toBe(false);
  });
});
