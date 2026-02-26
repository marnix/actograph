// storage.ts - SQLite database setup with WAL mode for concurrent access
// Uses XDG directories on Linux, timeout for automatic retry on locks

import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { mkdirSync } from "fs";

/**
 * Get the data directory for storing application data.
 * Uses XDG Base Directory specification on Linux for better integration.
 * Falls back to ~/.local/share/actograph if XDG_DATA_HOME is not set.
 *
 * TODO: Add Windows/macOS path support (see README TODO section)
 */
export function getDataDir(): string {
  const home = homedir();
  const dataDir = process.env.XDG_DATA_HOME
    ? join(process.env.XDG_DATA_HOME, "actograph")
    : join(home, ".local", "share", "actograph");

  mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

/**
 * Open the SQLite database with optimal settings for concurrent access.
 *
 * - timeout: 5000ms allows automatic retry on SQLITE_BUSY errors
 * - WAL mode: Enables multiple readers + one writer concurrency
 */
export function openDatabase(): Database.Database {
  const dbPath = join(getDataDir(), "actograph.db");
  const db = new Database(dbPath, { timeout: 5000 });

  // Enable Write-Ahead Logging for better concurrency
  db.pragma("journal_mode = WAL");

  return db;
}
