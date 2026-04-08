import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFile } from "child_process";
import { AutomergeAdapter } from "./automerge-adapter.js";

const workerScript = join(
  import.meta.dirname,
  "worker-add-complete.test-helper.ts",
);

function runWorker(
  dbPath: string,
  index: number,
): Promise<{ uuid: string; contention: number }> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ["--experimental-strip-types", workerScript, dbPath, String(index)],
      (err, stdout) => {
        if (err) return reject(err);
        const [uuid, c] = stdout.split(":");
        resolve({ uuid: uuid!, contention: Number(c) });
      },
    );
  });
}

describe("Concurrent CLI invocations (child processes)", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "actograph-concurrent-"));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should handle parallel add-and-complete with verified contention", async () => {
    const n = 10;
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const dbPath = join(testDir, `attempt-${attempt}.automerge`);

      const results = await Promise.all(
        Array.from({ length: n }, (_, i) => runWorker(dbPath, i)),
      );

      // Verify correctness
      const adapter = new AutomergeAdapter(dbPath);
      const actions = adapter.load();
      adapter.close();

      expect(actions).toHaveLength(n);
      for (const { uuid } of results) {
        const action = actions.find((a) => a.uuid === uuid);
        expect(action, `action ${uuid} should exist`).toBeDefined();
        expect(action!.state, `action ${uuid} should be done`).toBe("done");
      }

      // Check if real contention occurred
      const totalContention = results.reduce((sum, r) => sum + r.contention, 0);
      if (totalContention >= 5) {
        // Sufficient contention confirmed — test is meaningful
        return;
      }
      // Insufficient contention — retry to get a meaningful run
    }

    throw new Error(
      `No lock contention >= 5 detected in ${maxAttempts} attempts of ${n} workers — test is not exercising concurrency`,
    );
  }, 60_000);
});
