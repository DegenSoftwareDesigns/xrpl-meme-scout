import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { validateMigrationDirectories } from "../../src/storage/validate-migrations.js";

async function migrationRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "scout-migrations-"));
  await mkdir(path.join(root, "migrations", "postgres"), { recursive: true });
  await mkdir(path.join(root, "migrations", "sqlite"), { recursive: true });
  return root;
}

describe("migration directory contract", () => {
  it("accepts empty, paired Phase 0 migration directories", async () => {
    await expect(validateMigrationDirectories(await migrationRoot())).resolves.toBeUndefined();
  });

  it("requires paired and conventionally named migrations", async () => {
    const mismatchedRoot = await migrationRoot();
    await writeFile(
      path.join(mismatchedRoot, "migrations", "postgres", "0001_tokens.sql"),
      "-- placeholder",
      "utf8",
    );
    await expect(validateMigrationDirectories(mismatchedRoot)).rejects.toThrow(
      "must match exactly",
    );

    const invalidNameRoot = await migrationRoot();
    await writeFile(
      path.join(invalidNameRoot, "migrations", "postgres", "bad-name.sql"),
      "-- invalid",
      "utf8",
    );
    await expect(validateMigrationDirectories(invalidNameRoot)).rejects.toThrow(
      "Invalid migration filename",
    );
  });
});
