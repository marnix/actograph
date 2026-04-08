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
      {
        uuid: "u1",
        slug: "first",
        title: "First",
        state: "open",
        prerequisites: [],
      },
      {
        uuid: "u2",
        slug: "second",
        title: "Second",
        state: "done",
        prerequisites: [],
      },
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
      {
        uuid: "u1",
        slug: "first",
        title: "First",
        state: "open",
        prerequisites: [],
      },
    ]);
    adapter.save([
      {
        uuid: "u1",
        slug: "first",
        title: "First",
        state: "open",
        prerequisites: [],
      },
      {
        uuid: "u2",
        slug: "second",
        title: "Second",
        state: "open",
        prerequisites: [],
      },
    ]);

    const loaded = adapter.load();
    expect(loaded).toHaveLength(2);
    adapter.close();
  });

  it("should migrate old CVCVCVC-keyed format to UUID keys", () => {
    // Write a doc with old schema: CVCVCVC keys, no slug field
    type OldSchema = {
      actions: Record<
        string,
        {
          title: string;
          state: string;
          prerequisites: { actionId: string; createdAt: number }[];
        }
      >;
      priorities: { higher: string; lower: string; createdAt: number }[];
    };
    const doc = Automerge.from<OldSchema>({
      actions: {
        takapup: {
          title: "First",
          state: "open",
          prerequisites: [],
        },
        zebepod: {
          title: "Second",
          state: "done",
          prerequisites: [{ actionId: "takapup", createdAt: 0 }],
        },
      },
      priorities: [{ higher: "takapup", lower: "zebepod", createdAt: 0 }],
    });
    writeFileSync(dbPath, Automerge.save(doc));

    const adapter = new AutomergeAdapter(dbPath);
    const loaded = adapter.load();
    adapter.close();

    // Slugs should be the old keys
    const first = loaded.find((a) => a.slug === "takapup");
    const second = loaded.find((a) => a.slug === "zebepod");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.state).toBe("open");
    expect(second!.state).toBe("done");
    // UUIDs should be proper UUIDs, not the old keys
    expect(first!.uuid).not.toBe("takapup");
    expect(second!.uuid).not.toBe("zebepod");
    // Prerequisite should reference the new UUID
    expect(second!.prerequisites[0]!.uuid).toBe(first!.uuid);

    // Reload should give same UUIDs (migration persisted)
    const adapter2 = new AutomergeAdapter(dbPath);
    const reloaded = adapter2.load();
    adapter2.close();
    const first2 = reloaded.find((a) => a.slug === "takapup");
    expect(first2!.uuid).toBe(first!.uuid);
  });

  it("should migrate old 'completed' boolean to 'state'", () => {
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

    const adapter = new AutomergeAdapter(dbPath);
    const loaded = adapter.load();
    adapter.close();

    const open = loaded.find((a) => a.slug === "a1");
    const done = loaded.find((a) => a.slug === "a2");
    expect(open?.state).toBe("open");
    expect(done?.state).toBe("done");
  });
});
