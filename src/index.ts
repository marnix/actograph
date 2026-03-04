// index.ts - CLI entry point
// Jazz handles all data persistence and sync - we just define schemas and commands
// No traditional CRUD code needed - Jazz's CoValues are automatically persisted and synced

import { Command } from "commander";
import { SqliteAdapter } from "./adapters/sqlite-adapter.js";
import { getDataDir } from "./storage.js";
import { join } from "path";

// Commander provides CLI argument parsing with support for:
// - Subcommands (future: add, list, complete, etc.)
// - Global options (future: --db-path, --verbose, etc.)
// - Built-in help generation
const program = new Command();

program
  .name("actograph")
  .description("Local-first action management CLI")
  .version("0.1.0");

program.parse();

const adapter = new SqliteAdapter(join(getDataDir(), "actograph.db"));
const db = adapter.getDatabase();
console.log("Actograph initialized");
console.log("Database:", db.name);
adapter.close();
