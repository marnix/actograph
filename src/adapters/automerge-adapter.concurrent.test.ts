import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFile } from "child_process";
import { AutomergeAdapter } from "./automerge-adapter.js";

const workerScript = join(import.meta.dirname, "worker-add-complete.ts");

function runWorker(dbPath: string, index: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ["--experimental-strip-types", workerScript, dbPath, String(index)],
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

describe("Concurrent CLI invocations (child processes)", () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "actograph-concurrent-"));
    dbPath = join(testDir, "test.automerge");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should handle 100 truly parallel add-and-complete cycles", async () => {
    const n = 100;
    const ids = await Promise.all(
      Array.from({ length: n }, (_, i) => runWorker(dbPath, i)),
    );

    const adapter = new AutomergeAdapter(dbPath);
    const actions = adapter.load();
    adapter.close();

    expect(actions).toHaveLength(n);
    for (const id of ids) {
      const action = actions.find((a) => a.id === id);
      expect(action, `action ${id} should exist`).toBeDefined();
      expect(action!.completed, `action ${id} should be completed`).toBe(true);
    }
  }, 60_000);
});
