import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MIGRATION_FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;

async function migrationNames(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const sqlFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"));

  for (const file of sqlFiles) {
    if (!MIGRATION_FILE_PATTERN.test(file.name)) {
      throw new Error(`Invalid migration filename: ${path.join(directory, file.name)}`);
    }
  }

  return sqlFiles.map((file) => file.name).sort((left, right) => left.localeCompare(right));
}

export async function validateMigrationDirectories(repositoryRoot = process.cwd()): Promise<void> {
  const postgresNames = await migrationNames(path.join(repositoryRoot, "migrations", "postgres"));
  const sqliteNames = await migrationNames(path.join(repositoryRoot, "migrations", "sqlite"));

  if (JSON.stringify(postgresNames) !== JSON.stringify(sqliteNames)) {
    throw new Error("PostgreSQL and SQLite migration filenames must match exactly.");
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  await validateMigrationDirectories();
  console.log("Migration directories are valid.");
}
