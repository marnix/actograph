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

  it("should store and retrieve an action", () => {
    const db = adapter.getDatabase();

    // Create table
    db.exec(`
      CREATE TABLE actions (
        id INTEGER PRIMARY KEY,
        action TEXT NOT NULL
      )
    `);

    // Insert action
    const insert = db.prepare("INSERT INTO actions (action) VALUES (?)");
    const result = insert.run("Complete the project documentation");

    expect(result.changes).toBe(1);

    // Read back with new statement (simulating separate connection)
    const select = db.prepare("SELECT action FROM actions WHERE id = ?");
    const row = select.get(result.lastInsertRowid) as { action: string };

    expect(row.action).toBe("Complete the project documentation");
  });

  it("should handle concurrent reads", () => {
    const db = adapter.getDatabase();

    db.exec(`
      CREATE TABLE actions (
        id INTEGER PRIMARY KEY,
        action TEXT NOT NULL
      )
    `);

    const insert = db.prepare("INSERT INTO actions (action) VALUES (?)");
    insert.run("First action");
    insert.run("Second action");

    const select = db.prepare("SELECT action FROM actions ORDER BY id");
    const rows = select.all() as Array<{ action: string }>;

    expect(rows).toHaveLength(2);
    expect(rows[0].action).toBe("First action");
    expect(rows[1].action).toBe("Second action");
  });
});
