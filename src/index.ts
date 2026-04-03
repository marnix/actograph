// index.ts - CLI entry point

import { Command } from "commander";
import { randomUUID } from "crypto";
import { AutomergeAdapter } from "./adapters/automerge-adapter.js";
import { getDbPath } from "./storage.js";

const program = new Command();

program
  .name("actograph")
  .description("Local-first action management CLI")
  .version("0.1.0");

program
  .command("add")
  .description("Create a new action")
  .argument("<title>", "Action title")
  .action((title: string) => {
    const adapter = new AutomergeAdapter(getDbPath());
    const actions = adapter.load();
    actions.push({ id: randomUUID(), title, completed: false });
    adapter.save(actions);
    adapter.close();
    console.log(`Added: "${title}" (${actions.length} actions total)`);
  });

program
  .command("list")
  .description("List all actions")
  .action(() => {
    const adapter = new AutomergeAdapter(getDbPath());
    const actions = adapter.load();
    adapter.close();
    if (actions.length === 0) {
      console.log("No actions.");
      return;
    }
    for (const a of actions) {
      const mark = a.completed ? "✓" : " ";
      console.log(`[${mark}] ${a.title}  (${a.id})`);
    }
  });

program
  .command("complete")
  .description("Mark an action as completed")
  .argument("<id>", "Action ID (or prefix)")
  .action((idPrefix: string) => {
    const adapter = new AutomergeAdapter(getDbPath());
    const actions = adapter.load();
    const action = actions.find((a) => a.id.startsWith(idPrefix));
    if (!action) {
      console.error(`No action found matching "${idPrefix}"`);
      process.exit(1);
    }
    action.completed = true;
    adapter.save(actions);
    adapter.close();
    console.log(`Completed: "${action.title}"`);
  });

program.parse();
