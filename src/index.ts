// index.ts - CLI entry point
// Jazz handles all data persistence and sync - we just define schemas and commands
// No traditional CRUD code needed - Jazz's CoValues are automatically persisted and synced

import { Command } from "commander";
import { randomUUID } from "crypto";
import { ensureSyncServer } from "./sync-server.js";

// Commander provides CLI argument parsing with support for:
// - Subcommands (future: add, list, complete, etc.)
// - Global options (future: --db-path, --verbose, etc.)
// - Built-in help generation
const program = new Command();

program
  .name("actograph")
  .description("Local-first action management CLI")
  .version("0.1.0");

program
  .command("dosomething")
  .description("Create a new action")
  .action(async () => {
    try {
      const syncUrl = await ensureSyncServer();
      console.log(`Connected to sync server: ${syncUrl}`);
      
      // TODO: Connect to Jazz and create action
      const actionId = randomUUID();
      console.log(`Would create action: "do something ${actionId}"`);
      console.log("Number of actions now: [requires Jazz client implementation]");
      
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    } finally {
      // Allow process to exit by not keeping server alive
      process.exit(0);
    }
  });

program.parse();
