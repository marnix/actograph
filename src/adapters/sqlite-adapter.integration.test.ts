import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupJazzTestSync, createJazzTestAccount } from "jazz-tools/testing";
import { co, Account, CoMap } from "jazz-tools";
import { Action } from "../domain/action.js";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { SqliteAdapter } from "./sqlite-adapter.js";

class TestAccount extends Account {
  root = co.ref(CoMap);
}

describe("Jazz Concurrent Access Integration", () => {
  describe("In-Memory", () => {
    beforeEach(async () => {
      await setupJazzTestSync();
    });

    it("should handle 10 parallel action creations", async () => {
      // Create 10 accounts in parallel
      const accounts = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          createJazzTestAccount({
            AccountSchema: TestAccount,
            isCurrentActiveAccount: i === 0,
          })
        )
      );

      // Create 10 actions in parallel, each from a different account
      const createPromises = accounts.map((account, i) =>
        Action.create(
          {
            title: `Action ${i + 1}`,
            completed: false,
          },
          { owner: account }
        )
      );

      const actions = await Promise.all(createPromises);

      // Verify all 10 actions were created successfully
      expect(actions).toHaveLength(10);
      actions.forEach((action, i) => {
        expect(action.title).toBe(`Action ${i + 1}`);
        expect(action.completed).toBe(false);
      });
    });
  });

  describe("SQLite with WAL", () => {
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
});
