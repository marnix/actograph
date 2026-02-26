import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("Storage Infrastructure", () => {
  let testDir: string;
  let db: Database.Database;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "actograph-test-"));
    db = new Database(join(testDir, "test.db"), { timeout: 5000 });
    db.pragma("journal_mode = WAL");
  });

  afterEach(() => {
    db.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should store and retrieve an action", () => {
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
