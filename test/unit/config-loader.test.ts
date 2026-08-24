import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { parse, stringify } from "yaml";
import { describe, expect, it } from "vitest";

import {
  ConfigValidationError,
  hashTokenConfig,
  loadTokenConfigFile,
  loadTokenConfigs,
} from "../../src/config/loader.js";
import { TokenConfigSchema } from "../../src/config/token-schema.js";

const DROP_CONFIG_PATH = path.join(process.cwd(), "config", "tokens", "drop.yaml");

async function validDocument(): Promise<Record<string, unknown>> {
  return parse(await readFile(DROP_CONFIG_PATH, "utf8")) as Record<string, unknown>;
}

describe("token configuration loader", () => {
  it("loads, hashes, canonicalizes, and deeply freezes DROP", async () => {
    const first = await loadTokenConfigFile(DROP_CONFIG_PATH);
    const second = await loadTokenConfigFile(DROP_CONFIG_PATH);

    expect(first.canonicalTokenKey).toBe(
      "mainnet:rszenFJoDdiGjyezQc8pME9KWDQH43Tswh:44524F5000000000000000000000000000000000",
    );
    expect(first.configHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.configHash).toBe(second.configHash);
    expect(Object.isFrozen(first.config)).toBe(true);
    expect(Object.isFrozen(first.config.token)).toBe(true);
  });

  it("changes the hash when effective configuration changes", async () => {
    const loaded = await loadTokenConfigFile(DROP_CONFIG_PATH);
    const changedDocument = await validDocument();
    (changedDocument["history"] as Record<string, unknown>)["raw_retention_days"] = 91;
    const changedConfig = TokenConfigSchema.parse(changedDocument);
    expect(hashTokenConfig(changedConfig)).not.toBe(loaded.configHash);
  });

  it("sanitizes YAML and validation failures without echoing source values", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "scout-config-"));
    const invalidYamlPath = path.join(directory, "invalid.yaml");
    await writeFile(invalidYamlPath, "secret: [unterminated", "utf8");

    await expect(loadTokenConfigFile(invalidYamlPath)).rejects.toMatchObject({
      issues: ["<root>: invalid YAML syntax"],
    });

    const invalidSchemaPath = path.join(directory, "unknown.yaml");
    await writeFile(invalidSchemaPath, "schema_version: 1\nunexpected: sensitive-value\n", "utf8");
    try {
      await loadTokenConfigFile(invalidSchemaPath);
      throw new Error("Expected invalid configuration to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect((error as ConfigValidationError).issues.join(" ")).not.toContain("sensitive-value");
    }
  });

  it("rejects directories without YAML configuration", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "scout-empty-config-"));
    await expect(loadTokenConfigs(directory)).rejects.toBeInstanceOf(ConfigValidationError);
  });

  it("rejects duplicate token IDs across files", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "scout-duplicate-config-"));
    const document = await validDocument();
    await writeFile(path.join(directory, "a.yaml"), stringify(document), "utf8");

    const duplicateTuple = structuredClone(document);
    (duplicateTuple["token"] as Record<string, unknown>)["currency"] = "USD";
    const market = (duplicateTuple["markets"] as Record<string, unknown>[])[0];
    (market?.["base"] as Record<string, unknown>)["currency"] = "USD";
    await writeFile(path.join(directory, "b.yaml"), stringify(duplicateTuple), "utf8");

    await expect(loadTokenConfigs(directory)).rejects.toMatchObject({
      issues: ["token.id: duplicate token ID 'drop'"],
    });
  });
});
