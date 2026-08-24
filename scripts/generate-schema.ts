import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import { z } from "zod";

import { TokenConfigSchema } from "../src/config/token-schema.js";

export function createTokenConfigJsonSchema(): Record<string, unknown> {
  const generatedSchema = z.toJSONSchema(TokenConfigSchema, {
    target: "draft-2020-12",
    unrepresentable: "any",
  });

  return {
    ...generatedSchema,
    $id: "https://github.com/DegenSoftwareDesigns/xrpl-meme-scout/config/schema/token.schema.json",
    title: "xrpl-meme-scout token configuration",
    description:
      "Configuration contract for a monitored XRPL token. Runtime validation adds exact XRPL address, tuple, uniqueness, and cross-field checks.",
  };
}

export async function writeTokenConfigJsonSchema(repositoryRoot = process.cwd()): Promise<string> {
  const outputPath = path.join(repositoryRoot, "config", "schema", "token.schema.json");
  const output = await format(JSON.stringify(createTokenConfigJsonSchema()), {
    endOfLine: "lf",
    parser: "json",
    printWidth: 100,
  });
  await writeFile(outputPath, output, "utf8");
  return outputPath;
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  const outputPath = await writeTokenConfigJsonSchema(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  );
  console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
}
