import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFile } from "child_process";

const cli = join(import.meta.dirname, "..", "dist", "index.js");

function run(
  dataDir: string,
  ...args: string[]
): Promise<{ code: number | string | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [cli, "--data-dir", dataDir, ...args],
      (err, stdout, stderr) => {
        resolve({ code: err ? (err.code ?? 1) : 0, stdout, stderr });
      },
    );
  });
}

describe("CLI: state command on tag action (single process)", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "acto-smoke-"));
    await run(dataDir, "do", "++urgent");
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("rejects state change on tag action", async () => {
    const { code, stderr } = await run(dataDir, "go", "++urgent");
    expect(code).not.toBe(0);
    expect(stderr).toContain("Cannot change state of tag action");
  });
});
