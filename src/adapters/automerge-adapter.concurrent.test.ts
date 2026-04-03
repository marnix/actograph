import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Worker } from "worker_threads";
import { AutomergeAdapter } from "./automerge-adapter.js";

function runWorker(dbPath: string, index: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = new Worker(
      join(import.meta.dirname, "worker-add-complete.ts"),
      { workerData: { dbPath, index } },
    );
    w.on("message", resolve);
    w.on("error", reject);
    w.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

describe("Concurrent CLI invocations (worker threads)", () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "actograph-concurrent-"));
    dbPath = join(testDir, "test.automerge");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // Known-failing: no file locking yet, concurrent writers clobber each other.
  it.fails("should handle 100 truly parallel add-and-complete cycles", async () => {
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
  }, 30_000);
});
