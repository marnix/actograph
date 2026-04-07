// index.ts - CLI entry point

import { Command } from "commander";
import { generateActionId } from "./domain/action-id.js";
import { computeWorkOrder } from "./domain/work-order.js";
import { spDecompose } from "./domain/sp-decompose.js";
import { renderSP } from "./domain/render-sp.js";
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
  // length is exactly 1 here; destructuring is safe
  const [match] = matches as [T];
  return match;
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
    const priorities = adapter.loadPriorities();
    adapter.close();
    if (actions.length === 0) {
      console.log("No actions.");
      return;
    }
    const actionMap = new Map(actions.map((a) => [a.id, a]));
    const graph = computeWorkOrder(actions, priorities);
    const sp = spDecompose(graph);
    const output = renderSP(sp, (id) => {
      const a = actionMap.get(id);
      if (!a) return id;
      const mark = a.completed ? "✓" : " ";
      return `[${mark}] ${a.title}  (${a.id})`;
    });
    console.log(output);
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
    resolved.reduce((prev, curr) => {
      if (!curr.prerequisites.some((p) => p.actionId === prev.id)) {
        curr.prerequisites.push({
          actionId: prev.id,
          createdAt: Date.now(),
        });
        added++;
      }
      return curr;
    });
    adapter.save(actions);
    adapter.close();
    console.log(`Added ${added} prerequisite(s)`);
  });

program
  .command("prio")
  .description(
    "Set priorities: acto prio A B C means A has priority over B, B has priority over C",
  )
  .argument("<ids...>", "Action IDs (or prefixes) in priority order")
  .action((ids: string[]) => {
    if (ids.length < 2) {
      console.error("Need at least two action IDs");
      process.exit(1);
    }
    const adapter = new AutomergeAdapter(getDbPath());
    const actions = adapter.load();
    const resolved = ids.map((prefix) => findAction(actions, prefix));
    const priorities = adapter.loadPriorities();
    let added = 0;
    resolved.reduce((prev, curr) => {
      if (
        !priorities.some((p) => p.higher === prev.id && p.lower === curr.id)
      ) {
        priorities.push({
          higher: prev.id,
          lower: curr.id,
          createdAt: Date.now(),
        });
        added++;
      }
      return curr;
    });
    adapter.savePriorities(priorities);
    adapter.close();
    console.log(`Added ${added} priority relation(s)`);
  });

program.parse();
