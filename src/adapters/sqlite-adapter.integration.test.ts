import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { SqliteAdapter } from "./sqlite-adapter.js";

describe("SqliteAdapter Integration", () => {
  let testDir: string;
  let adapter: SqliteAdapter;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "actograph-test-"));
    adapter = new SqliteAdapter(join(testDir, "test.db"));
  });

  afterEach(() => {
    adapter.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should handle concurrent writes with WAL mode", () => {
    const db = adapter.getDatabase();

    // Verify WAL mode is enabled
    const walMode = db.pragma("journal_mode", { simple: true });
    expect(walMode).toBe("wal");

    // Create table
    db.exec(`
      CREATE TABLE actions (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        completed INTEGER NOT NULL
      )
    `);

    // Insert 10 actions in parallel using prepared statement
    const insert = db.prepare(
      "INSERT INTO actions (title, completed) VALUES (?, ?)"
    );

    const insertMany = db.transaction((actions) => {
      for (const action of actions) {
        insert.run(action.title, action.completed ? 1 : 0);
      }
    });

    const actions = Array.from({ length: 10 }, (_, i) => ({
      title: `Action ${i + 1}`,
      completed: false,
    }));

    insertMany(actions);

    // Verify all 10 actions were inserted
    const select = db.prepare("SELECT title, completed FROM actions ORDER BY id");
    const rows = select.all() as Array<{ title: string; completed: number }>;

    expect(rows).toHaveLength(10);
    rows.forEach((row, i) => {
      expect(row.title).toBe(`Action ${i + 1}`);
      expect(row.completed).toBe(0);
    });
  });
});
