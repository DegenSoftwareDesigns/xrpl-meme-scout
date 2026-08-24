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
