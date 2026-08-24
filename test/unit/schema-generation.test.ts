import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createTokenConfigJsonSchema } from "../../scripts/generate-schema.js";

describe("generated JSON Schema", () => {
  it("matches the committed configuration schema", async () => {
    const committed = JSON.parse(
      await readFile(path.join(process.cwd(), "config", "schema", "token.schema.json"), "utf8"),
    ) as unknown;
    expect(committed).toEqual(createTokenConfigJsonSchema());
  });
});
