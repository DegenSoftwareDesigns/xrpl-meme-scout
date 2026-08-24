import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createTokenConfigJsonSchema,
  writeTokenConfigJsonSchema,
} from "../../scripts/generate-schema.js";

describe("generated JSON Schema", () => {
  it("matches the committed configuration schema", async () => {
    const committed = JSON.parse(
      await readFile(path.join(process.cwd(), "config", "schema", "token.schema.json"), "utf8"),
    ) as unknown;
    expect(committed).toEqual(createTokenConfigJsonSchema());
  });

  it("writes the generated schema beneath an explicit repository root", async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), "scout-schema-"));
    await mkdir(path.join(repositoryRoot, "config", "schema"), { recursive: true });

    const outputPath = await writeTokenConfigJsonSchema(repositoryRoot);
    expect(outputPath).toBe(path.join(repositoryRoot, "config", "schema", "token.schema.json"));
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual(createTokenConfigJsonSchema());
  });

  it("runs as the schema-generation entrypoint", async () => {
    const originalArguments = [...process.argv];
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    process.argv = [process.execPath, path.join(process.cwd(), "scripts", "generate-schema.ts")];
    vi.resetModules();

    try {
      await import("../../scripts/generate-schema.js");
      expect(log).toHaveBeenCalledWith(expect.stringContaining("token.schema.json"));
    } finally {
      process.argv = originalArguments;
    }
  });
});
