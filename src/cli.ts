#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

import { ConfigValidationError, loadTokenConfigs } from "./config/loader.js";

export interface CliIo {
  readonly stderr: (message: string) => void;
  readonly stdout: (message: string) => void;
}

const defaultIo: CliIo = {
  stderr: (message) => process.stderr.write(message),
  stdout: (message) => process.stdout.write(message),
};

const HELP = `xrpl-meme-scout (Phase 0)\n\nUsage:\n  scout config validate [--config-dir config/tokens]\n  scout --help\n`;

function parseConfigDirectory(arguments_: readonly string[]): string {
  let configDirectory = "config/tokens";

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument !== "--config-dir") {
      throw new Error(`Unknown option: ${argument ?? "<missing>"}`);
    }

    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error("--config-dir requires a directory path");
    }

    configDirectory = value;
    index += 1;
  }

  return configDirectory;
}

export async function runCli(
  arguments_: readonly string[],
  io: CliIo = defaultIo,
): Promise<number> {
  if (arguments_.length === 0 || arguments_[0] === "--help" || arguments_[0] === "-h") {
    io.stdout(HELP);
    return 0;
  }

  if (arguments_[0] !== "config" || arguments_[1] !== "validate") {
    io.stderr(`Unknown command: ${arguments_.join(" ")}\n\n${HELP}`);
    return 2;
  }

  try {
    const configDirectory = parseConfigDirectory(arguments_.slice(2));
    const configs = await loadTokenConfigs(configDirectory);
    io.stdout(
      `${JSON.stringify({
        config_directory: path.resolve(configDirectory),
        event: "config.validated",
        tokens: configs.map((loadedConfig) => ({
          canonical_token_key: loadedConfig.canonicalTokenKey,
          config_hash: loadedConfig.configHash,
          token_id: loadedConfig.config.token.id,
        })),
      })}\n`,
    );
    return 0;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      io.stderr(`${error.message}\n${error.issues.map((issue) => `- ${issue}`).join("\n")}\n`);
      return 1;
    }

    io.stderr(`${error instanceof Error ? error.message : "Unknown configuration error"}\n`);
    return 1;
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  process.exitCode = await runCli(process.argv.slice(2));
}
