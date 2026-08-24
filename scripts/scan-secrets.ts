import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface SecretRule {
  readonly name: string;
  readonly pattern: RegExp;
}

const SKIPPED_DIRECTORIES = new Set([".git", "coverage", "dist", "node_modules", "reports"]);
const MAX_SCANNED_FILE_BYTES = 5 * 1024 * 1024;

const SECRET_RULES: readonly SecretRule[] = [
  {
    name: "GitHub token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  },
  {
    name: "Discord webhook",
    pattern:
      /https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/,
  },
  {
    name: "credential-bearing database URL",
    pattern: /\bpostgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/,
  },
  {
    name: "private key",
    pattern: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/,
  },
  {
    name: "XRPL family seed",
    pattern: /\bs[1-9A-HJ-NP-Za-km-z]{28,35}\b/,
  },
];

async function repositoryFiles(directory: string): Promise<readonly string[]> {
  const files: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...(await repositoryFiles(path.join(directory, entry.name))));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

export async function scanRepositoryForSecrets(
  repositoryRoot = process.cwd(),
): Promise<readonly string[]> {
  const findings: string[] = [];

  for (const filePath of await repositoryFiles(repositoryRoot)) {
    const content = await readFile(filePath);
    if (content.byteLength > MAX_SCANNED_FILE_BYTES || content.includes(0)) {
      continue;
    }

    const relativePath = path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
    const lines = content.toString("utf8").split(/\r?\n/);

    for (const [lineIndex, line] of lines.entries()) {
      for (const rule of SECRET_RULES) {
        if (rule.pattern.test(line)) {
          findings.push(`${relativePath}:${String(lineIndex + 1)}: ${rule.name}`);
        }
      }
    }
  }

  return findings;
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  const findings = await scanRepositoryForSecrets();
  if (findings.length > 0) {
    console.error(
      `Potential secrets detected:\n${findings.map((finding) => `- ${finding}`).join("\n")}`,
    );
    process.exitCode = 1;
  } else {
    console.log("No secret-shaped values detected.");
  }
}
