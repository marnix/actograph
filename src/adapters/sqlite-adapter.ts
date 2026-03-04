// SQLite storage adapter
import Database from "better-sqlite3";
import { StoragePort } from "../ports/storage-port.js";

export class SqliteAdapter implements StoragePort {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { timeout: 5000 });
    this.db.pragma("journal_mode = WAL");
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
