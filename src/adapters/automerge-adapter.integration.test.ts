import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { AutomergeAdapter } from "./automerge-adapter.js";

describe("AutomergeAdapter Integration", () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "actograph-test-"));
    dbPath = join(testDir, "test.automerge");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should persist and reload actions", () => {
    const adapter = new AutomergeAdapter(dbPath);
    adapter.save([
      { id: "1", title: "First", completed: false, prerequisites: [] },
      { id: "2", title: "Second", completed: true, prerequisites: [] },
    ]);
    adapter.close();

    const adapter2 = new AutomergeAdapter(dbPath);
    const loaded = adapter2.load();
    adapter2.close();

    expect(loaded).toHaveLength(2);
    expect(loaded[0]!.title).toBe("First");
    expect(loaded[1]!.completed).toBe(true);
  });

  it("should start empty when no file exists", () => {
    const adapter = new AutomergeAdapter(dbPath);
    expect(adapter.load()).toHaveLength(0);
    adapter.close();
  });

  it("should handle multiple saves", () => {
    const adapter = new AutomergeAdapter(dbPath);

    adapter.save([
      { id: "1", title: "First", completed: false, prerequisites: [] },
    ]);
    adapter.save([
      { id: "1", title: "First", completed: false, prerequisites: [] },
      { id: "2", title: "Second", completed: false, prerequisites: [] },
    ]);

    const loaded = adapter.load();
    expect(loaded).toHaveLength(2);
    adapter.close();
  });
});
