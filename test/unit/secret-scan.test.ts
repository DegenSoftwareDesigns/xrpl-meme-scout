import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { scanRepositoryForSecrets } from "../../scripts/scan-secrets.js";

async function temporaryRepository(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

describe("repository secret scanner", () => {
  it("recurses through text while skipping ignored, binary, and oversized content", async () => {
    const root = await temporaryRepository("scout-secret-scan-clean-");
    await mkdir(path.join(root, "nested"));
    await mkdir(path.join(root, "symlink-target"));
    await mkdir(path.join(root, ".git"));
    await mkdir(path.join(root, "reports"));
    await symlink(path.join(root, "symlink-target"), path.join(root, "directory-link"), "junction");
    await writeFile(path.join(root, "nested", "safe.txt"), "ordinary configuration\n", "utf8");
    await writeFile(
      path.join(root, ".git", "ignored.txt"),
      ["gh", "p_", "a".repeat(20)].join(""),
      "utf8",
    );
    await writeFile(path.join(root, "reports", "ignored.txt"), "ignored report", "utf8");
    await writeFile(path.join(root, "binary.dat"), Buffer.from([1, 0, 2]));
    await writeFile(path.join(root, "oversized.txt"), Buffer.alloc(5 * 1024 * 1024 + 1, 65));

    await expect(scanRepositoryForSecrets(root)).resolves.toEqual([]);
  });

  it("reports every supported secret shape without echoing the secret value", async () => {
    const root = await temporaryRepository("scout-secret-scan-findings-");
    const syntheticSecrets = [
      ["gh", "p_", "a".repeat(20)].join(""),
      ["https://", "discord.com/api/webhooks/123/", "synthetic_token"].join(""),
      ["postgresql://", "user:password", "@localhost/database"].join(""),
      ["-----BEGIN ", "PRIVATE KEY-----"].join(""),
      ["s", "1".repeat(28)].join(""),
    ];
    await writeFile(path.join(root, "secrets.txt"), syntheticSecrets.join("\n"), "utf8");

    const findings = await scanRepositoryForSecrets(root);
    expect(findings).toEqual([
      "secrets.txt:1: GitHub token",
      "secrets.txt:2: Discord webhook",
      "secrets.txt:3: credential-bearing database URL",
      "secrets.txt:4: private key",
      "secrets.txt:5: XRPL family seed",
    ]);
    expect(findings.join("\n")).not.toContain("synthetic_token");
    expect(findings.join("\n")).not.toContain("user:password");
  });

  it("sets the process result when run as the scanner entrypoint", async () => {
    const cleanRoot = await temporaryRepository("scout-secret-scan-entry-clean-");
    const findingRoot = await temporaryRepository("scout-secret-scan-entry-finding-");
    await writeFile(
      path.join(findingRoot, "secret.txt"),
      ["gh", "p_", "a".repeat(20)].join(""),
      "utf8",
    );

    const originalArguments = [...process.argv];
    const originalDirectory = process.cwd();
    const originalExitCode = process.exitCode;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.argv = [process.execPath, path.join(originalDirectory, "scripts", "scan-secrets.ts")];

    try {
      process.chdir(findingRoot);
      vi.resetModules();
      await import("../../scripts/scan-secrets.js");
      expect(process.exitCode).toBe(1);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Potential secrets detected"));

      process.chdir(cleanRoot);
      process.exitCode = undefined;
      vi.resetModules();
      await import("../../scripts/scan-secrets.js");
      expect(process.exitCode).toBeUndefined();
      expect(log).toHaveBeenCalledWith("No secret-shaped values detected.");
    } finally {
      process.argv = originalArguments;
      process.chdir(originalDirectory);
      process.exitCode = originalExitCode;
    }
  });
});
