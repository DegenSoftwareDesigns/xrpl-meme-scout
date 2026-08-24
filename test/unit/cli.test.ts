import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runCli, type CliIo } from "../../src/cli.js";

function captureIo(): { io: CliIo; stderr: string[]; stdout: string[] } {
  const stderr: string[] = [];
  const stdout: string[] = [];
  return {
    io: {
      stderr: (message) => stderr.push(message),
      stdout: (message) => stdout.push(message),
    },
    stderr,
    stdout,
  };
}

describe("Phase 0 CLI", () => {
  it("prints help when no command is supplied", async () => {
    const capture = captureIo();
    expect(await runCli([], capture.io)).toBe(0);
    expect(capture.stdout.join("")).toContain("scout config validate");
  });

  it("writes through the process streams when no IO adapter is supplied", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    expect(await runCli([])).toBe(0);
    expect(await runCli(["monitor", "--once"])).toBe(2);
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("scout config validate"));
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("Unknown command"));
  });

  it("sets the process exit code when loaded as the executable entrypoint", async () => {
    const originalArguments = [...process.argv];
    const originalExitCode = process.exitCode;
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.argv = [process.execPath, path.join(process.cwd(), "src", "cli.ts"), "--help"];
    vi.resetModules();

    try {
      await import("../../src/cli.js");
      expect(process.exitCode).toBe(0);
      expect(stdout).toHaveBeenCalledWith(expect.stringContaining("scout config validate"));
    } finally {
      process.argv = originalArguments;
      process.exitCode = originalExitCode;
    }
  });

  it("validates DROP and emits its canonical key and config hash", async () => {
    const capture = captureIo();
    const configDirectory = path.join(process.cwd(), "config", "tokens");
    expect(await runCli(["config", "validate", "--config-dir", configDirectory], capture.io)).toBe(
      0,
    );
    expect(capture.stderr).toEqual([]);
    const result = JSON.parse(capture.stdout.join("")) as {
      tokens: { canonical_token_key: string; config_hash: string }[];
    };
    expect(result.tokens[0]?.canonical_token_key).toContain("mainnet:rszenFJo");
    expect(result.tokens[0]?.config_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns non-zero for invalid configuration and unknown commands", async () => {
    const invalidCapture = captureIo();
    expect(
      await runCli(
        [
          "config",
          "validate",
          "--config-dir",
          path.join(process.cwd(), "test", "fixtures", "config"),
        ],
        invalidCapture.io,
      ),
    ).toBe(1);
    expect(invalidCapture.stderr.join("")).toContain("Invalid token configuration");

    const commandCapture = captureIo();
    expect(await runCli(["monitor", "--once"], commandCapture.io)).toBe(2);
    expect(commandCapture.stderr.join("")).toContain("Unknown command");
  });

  it("rejects missing and unknown config options", async () => {
    const missingValue = captureIo();
    expect(await runCli(["config", "validate", "--config-dir"], missingValue.io)).toBe(1);
    expect(missingValue.stderr.join("")).toContain("requires a directory path");

    const unknownOption = captureIo();
    expect(await runCli(["config", "validate", "--wat"], unknownOption.io)).toBe(1);
    expect(unknownOption.stderr.join("")).toContain("Unknown option");

    const sparseOption = captureIo();
    const missingOption = [...new Array<string>(1)];
    expect(await runCli(["config", "validate", ...missingOption], sparseOption.io)).toBe(1);
    expect(sparseOption.stderr.join("")).toContain("Unknown option: <missing>");
  });
});
