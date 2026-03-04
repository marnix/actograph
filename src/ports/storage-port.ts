// Port interface for storage operations
import Database from "better-sqlite3";

export interface StoragePort {
  getDatabase(): Database.Database;
  close(): void;
}
