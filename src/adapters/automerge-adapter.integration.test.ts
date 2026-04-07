import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as Automerge from "@automerge/automerge";
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
      { id: "1", title: "First", state: "open", prerequisites: [] },
      { id: "2", title: "Second", state: "done", prerequisites: [] },
    ]);
    adapter.close();

    const adapter2 = new AutomergeAdapter(dbPath);
    const loaded = adapter2.load();
    adapter2.close();

    expect(loaded).toHaveLength(2);
    expect(loaded[0]!.title).toBe("First");
    expect(loaded[1]!.state).toBe("done");
  });

  it("should start empty when no file exists", () => {
    const adapter = new AutomergeAdapter(dbPath);
    expect(adapter.load()).toHaveLength(0);
    adapter.close();
  });

  it("should handle multiple saves", () => {
    const adapter = new AutomergeAdapter(dbPath);

    adapter.save([
      { id: "1", title: "First", state: "open", prerequisites: [] },
    ]);
    adapter.save([
      { id: "1", title: "First", state: "open", prerequisites: [] },
      { id: "2", title: "Second", state: "open", prerequisites: [] },
    ]);

    const loaded = adapter.load();
    expect(loaded).toHaveLength(2);
    adapter.close();
  });

  it("should migrate old 'completed' boolean to 'state'", () => {
    // Write a doc with the old schema (completed: boolean)
    type OldSchema = {
      actions: Record<
        string,
        { title: string; completed: boolean; prerequisites: never[] }
      >;
    };
    const doc = Automerge.from<OldSchema>({
      actions: {
        a1: { title: "Open task", completed: false, prerequisites: [] },
        a2: { title: "Done task", completed: true, prerequisites: [] },
      },
    });
    writeFileSync(dbPath, Automerge.save(doc));

    // Read with current adapter — should migrate to state
    const adapter = new AutomergeAdapter(dbPath);
    const loaded = adapter.load();
    adapter.close();

    const open = loaded.find((a) => a.id === "a1");
    const done = loaded.find((a) => a.id === "a2");
    expect(open?.state).toBe("open");
    expect(done?.state).toBe("done");
  });
});
