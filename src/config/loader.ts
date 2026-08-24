import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { ZodError } from "zod";

import { canonicalTokenKey } from "../domain/assets.js";
import { TokenConfigSchema, type TokenConfig } from "./token-schema.js";

export interface LoadedTokenConfig {
  readonly canonicalTokenKey: string;
  readonly config: Readonly<TokenConfig>;
  readonly configHash: string;
  readonly sourcePath: string;
}

export class ConfigValidationError extends Error {
  public readonly issues: readonly string[];
  public readonly sourcePath: string;

  public constructor(sourcePath: string, issues: readonly string[]) {
    super(`Invalid token configuration: ${path.basename(sourcePath)}`);
    this.name = "ConfigValidationError";
    this.sourcePath = sourcePath;
    this.issues = issues;
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)]),
    );
  }

  return value;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    Object.freeze(value);
  }

  return value;
}

export function hashTokenConfig(config: TokenConfig): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(config)))
    .digest("hex");
}

function formatZodIssues(error: ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const issuePath = issue.path.length === 0 ? "<root>" : issue.path.join(".");
    return `${issuePath}: ${issue.message}`;
  });
}

export async function loadTokenConfigFile(sourcePath: string): Promise<LoadedTokenConfig> {
  const absolutePath = path.resolve(sourcePath);
  const yamlText = await readFile(absolutePath, "utf8");
  let untrustedDocument: unknown;

  try {
    untrustedDocument = parse(yamlText, { prettyErrors: false, uniqueKeys: true });
  } catch {
    throw new ConfigValidationError(absolutePath, ["<root>: invalid YAML syntax"]);
  }

  let config: TokenConfig;
  try {
    config = TokenConfigSchema.parse(untrustedDocument);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ConfigValidationError(absolutePath, formatZodIssues(error));
    }

    throw error;
  }

  const frozenConfig = deepFreeze(config);

  return Object.freeze({
    canonicalTokenKey: canonicalTokenKey(frozenConfig.token),
    config: frozenConfig,
    configHash: hashTokenConfig(config),
    sourcePath: absolutePath,
  });
}

export async function loadTokenConfigs(
  configDirectory: string,
): Promise<readonly LoadedTokenConfig[]> {
  const absoluteDirectory = path.resolve(configDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const configFiles = entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(absoluteDirectory, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (configFiles.length === 0) {
    throw new ConfigValidationError(absoluteDirectory, ["<root>: no token YAML files found"]);
  }

  const loadedConfigs: LoadedTokenConfig[] = [];
  for (const configFile of configFiles) {
    loadedConfigs.push(await loadTokenConfigFile(configFile));
  }

  const tokenIds = new Set<string>();
  const canonicalKeys = new Set<string>();
  for (const loadedConfig of loadedConfigs) {
    if (tokenIds.has(loadedConfig.config.token.id)) {
      throw new ConfigValidationError(loadedConfig.sourcePath, [
        `token.id: duplicate token ID '${loadedConfig.config.token.id}'`,
      ]);
    }

    if (canonicalKeys.has(loadedConfig.canonicalTokenKey)) {
      throw new ConfigValidationError(loadedConfig.sourcePath, [
        `token: duplicate canonical tuple '${loadedConfig.canonicalTokenKey}'`,
      ]);
    }

    tokenIds.add(loadedConfig.config.token.id);
    canonicalKeys.add(loadedConfig.canonicalTokenKey);
  }

  return Object.freeze(loadedConfigs);
}
