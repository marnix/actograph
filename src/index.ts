// index.ts - CLI entry point

import { Command } from "commander";
import { generateActionId } from "./domain/action-id.js";
import { AutomergeAdapter } from "./adapters/automerge-adapter.js";
import { getDbPath } from "./storage.js";

const program = new Command();

program
  .name("actograph")
  .description("Local-first action management CLI")
  .version("0.1.0");

function findAction<T extends { id: string }>(actions: T[], prefix: string): T {
  const matches = actions.filter((a) => a.id.startsWith(prefix));
  if (matches.length === 0) {
    console.error(`No action found matching "${prefix}"`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(
      `Ambiguous prefix "${prefix}": matches ${matches.map((a) => a.id).join(", ")}`,
    );
    process.exit(1);
  }
  return matches[0];
}

program
  .command("add")
  .description("Create a new action")
  .argument("<title>", "Action title")
  .action((title: string) => {
    const adapter = new AutomergeAdapter(getDbPath());
    const actions = adapter.load();
    actions.push({
      id: generateActionId(),
      title,
      completed: false,
      prerequisites: [],
    });
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
      const reqs =
        a.prerequisites.length > 0
          ? `  req: ${a.prerequisites.map((p) => p.actionId).join(", ")}`
          : "";
      console.log(`[${mark}] ${a.title}  (${a.id})${reqs}`);
    }
  });

program
  .command("complete")
  .description("Mark an action as completed")
  .argument("<id>", "Action ID (or prefix)")
  .action((idPrefix: string) => {
    const adapter = new AutomergeAdapter(getDbPath());
    const actions = adapter.load();
    const action = findAction(actions, idPrefix);
    action.completed = true;
    adapter.save(actions);
    adapter.close();
    console.log(`Completed: "${action.title}"`);
  });

program
  .command("req")
  .description(
    "Set prerequisites: acto req A B C means A is required by B, B is required by C",
  )
  .argument("<ids...>", "Action IDs (or prefixes) in work order")
  .action((ids: string[]) => {
    if (ids.length < 2) {
      console.error("Need at least two action IDs");
      process.exit(1);
    }
    const adapter = new AutomergeAdapter(getDbPath());
    const actions = adapter.load();
    const resolved = ids.map((prefix) => findAction(actions, prefix));
    let added = 0;
    for (let i = 1; i < resolved.length; i++) {
      const dependent = actions.find((a) => a.id === resolved[i].id)!;
      const reqId = resolved[i - 1].id;
      if (!dependent.prerequisites.some((p) => p.actionId === reqId)) {
        dependent.prerequisites.push({
          actionId: reqId,
          createdAt: Date.now(),
        });
        added++;
      }
    }
    adapter.save(actions);
    adapter.close();
    console.log(`Added ${added} prerequisite(s)`);
  });

program.parse();
