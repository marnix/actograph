import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { mkdirSync } from "fs";

export function getDataDir(): string {
  const home = homedir();
  const dataDir = process.env.XDG_DATA_HOME
    ? join(process.env.XDG_DATA_HOME, "actograph")
    : join(home, ".local", "share", "actograph");
  
  mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

export function openDatabase(): Database.Database {
  const dbPath = join(getDataDir(), "actograph.db");
  const db = new Database(dbPath, { timeout: 5000 });
  db.pragma("journal_mode = WAL");
  return db;
}
