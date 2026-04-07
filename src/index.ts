// index.ts - CLI entry point

import { Command } from "commander";
import { generateActionId } from "./domain/action-id.js";
import type { ActionState } from "./domain/action.js";
import { transitionAction } from "./domain/action.js";
import { isTagTitle } from "./domain/tags.js";
import {
  computeWorkOrder,
  expandTagRelations,
  addPrerequisite,
  addPriority,
  removePrerequisite,
  removePriority,
} from "./domain/work-order.js";
import { spDecompose } from "./domain/sp-decompose.js";
import { renderSP } from "./domain/render-sp.js";
import { AutomergeAdapter } from "./adapters/automerge-adapter.js";
import { getDataDir } from "./storage.js";
import { join } from "path";
import { mkdirSync } from "fs";

const program = new Command();

program
  .name("actograph")
  .description("Local-first action management CLI")
  .version("0.1.0")
  .option("--data-dir <path>", "Override data directory");

function resolveDataDir(): string {
  const override = (program.opts() as { dataDir?: string }).dataDir;
  if (override) {
    mkdirSync(override, { recursive: true });
    return override;
  }
  return getDataDir();
}

function dbPath(): string {
  return join(resolveDataDir(), "actograph.automerge");
}

function findAction<T extends { id: string; title: string }>(
  actions: T[],
  prefix: string,
): T {
  // Try matching by tag title first (e.g. "++urgent")
  if (prefix.startsWith("++")) {
    const tagMatches = actions.filter((a) => a.title === prefix);
    if (tagMatches.length === 1) return tagMatches[0] as T;
    if (tagMatches.length > 1) {
      console.error(
        `Ambiguous tag "${prefix}": matches ${tagMatches.map((a) => a.id).join(", ")}`,
      );
      process.exit(1);
    }
    // fall through to ID prefix matching
  }
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

// --- Work ---

program
  .command("list")
  .description(
    "List actions (open/active only; use -a for all, --tags for tag actions)",
  )
  .option("-a, --all", "Show all actions including done and skipped")
  .option("-t, --tags", "Show only tag actions")
  .action((opts: { all?: boolean; tags?: boolean }) => {
    const adapter = new AutomergeAdapter(dbPath());
    const actions = adapter.load();
    const priorities = adapter.loadPriorities();
    adapter.close();

    if (opts.tags) {
      const tagActions = actions.filter((a) => isTagTitle(a.title));
      if (tagActions.length === 0) {
        console.log("No tag actions.");
        return;
      }
      const tagMap = new Map(tagActions.map((a) => [a.id, a]));
      const graph = computeWorkOrder(tagActions, priorities);
      const prioPreds = new Map<string, Set<string>>();
      for (const p of priorities) {
        if (tagMap.has(p.higher) && tagMap.has(p.lower)) {
          if (!prioPreds.has(p.lower)) prioPreds.set(p.lower, new Set());
          prioPreds.get(p.lower)!.add(p.higher);
        }
      }
      const sp = spDecompose(graph);
      const output = renderSP(sp, (id) => {
        const a = tagMap.get(id);
        if (!a) return id;
        const prios = prioPreds.get(id);
        const parts: string[] = [];
        if (prios) parts.push(...Array.from(prios).map((p) => `prio:${p}`));
        const suffix = parts.length > 0 ? `  ← ${parts.join(", ")}` : "";
        return `${a.title}  (${a.id})${suffix}`;
      });
      console.log(output);
      return;
    }

    const visible = opts.all
      ? actions.filter((a) => !isTagTitle(a.title))
      : actions.filter(
          (a) =>
            !isTagTitle(a.title) &&
            (a.state === "open" || a.state === "active"),
        );
    if (visible.length === 0) {
      console.log(opts.all ? "No actions." : "No open/active actions.");
      return;
    }
    const actionMap = new Map(visible.map((a) => [a.id, a]));
    const allMap = new Map(actions.map((a) => [a.id, a]));
    const graph = computeWorkOrder(
      visible,
      priorities,
      opts.all ? undefined : actions,
    );

    // Build lookup: for each visible action, which visible actions
    // are direct predecessors via req or prio?
    const reqPreds = new Map<string, Set<string>>();
    const prioPreds = new Map<string, Set<string>>();
    for (const a of visible) {
      // Direct and transitive-through-hidden prerequisite predecessors
      for (const p of a.prerequisites) {
        if (actionMap.has(p.actionId)) {
          if (!reqPreds.has(a.id)) reqPreds.set(a.id, new Set());
          reqPreds.get(a.id)!.add(p.actionId);
        }
      }
    }
    for (const p of priorities) {
      if (actionMap.has(p.higher) && actionMap.has(p.lower)) {
        if (!prioPreds.has(p.lower)) prioPreds.set(p.lower, new Set());
        prioPreds.get(p.lower)!.add(p.higher);
      }
    }
    // Include tag-expanded priorities in annotations
    const { extraPrios } = expandTagRelations(actions, priorities);
    for (const p of extraPrios) {
      if (actionMap.has(p.higher) && actionMap.has(p.lower)) {
        if (!prioPreds.has(p.lower)) prioPreds.set(p.lower, new Set());
        prioPreds.get(p.lower)!.add(p.higher);
      }
    }

    const sp = spDecompose(graph);
    const output = renderSP(sp, (id) => {
      const a = actionMap.get(id);
      if (!a) return id;
      const mark =
        a.state === "done"
          ? "✓"
          : a.state === "active"
            ? "▶"
            : a.state === "skipped"
              ? "–"
              : " ";
      const reqs = reqPreds.get(id);
      const prios = prioPreds.get(id);
      const parts: string[] = [];
      if (reqs) parts.push(...Array.from(reqs).map((r) => `req:${r}`));
      if (prios) parts.push(...Array.from(prios).map((p) => `prio:${p}`));
      const suffix = parts.length > 0 ? `  ← ${parts.join(", ")}` : "";
      return `[${mark}] ${a.title}  (${a.id})${suffix}`;
    });
    console.log(output);
  });

program
  .command("do")
  .description("Add a new action")
  .argument("<title>", "Action title")
  .action((title: string) => {
    const adapter = new AutomergeAdapter(dbPath());
    const actions = adapter.load();
    actions.push({
      id: generateActionId(),
      title,
      state: "open",
      prerequisites: [],
    });
    adapter.save(actions);
    adapter.close();
    console.log(`Added: "${title}" (${actions.length} actions total)`);
  });

// --- Lifecycle ---

function stateCommand(
  name: string,
  description: string,
  newState: ActionState,
  label: string,
): void {
  program
    .command(name)
    .description(description)
    .argument("<id>", "Action ID (or prefix)")
    .action((idPrefix: string) => {
      const adapter = new AutomergeAdapter(dbPath());
      const actions = adapter.load();
      const action = findAction(actions, idPrefix);
      try {
        transitionAction(action, newState);
      } catch (e) {
        adapter.close();
        console.error((e as Error).message);
        process.exit(1);
      }
      adapter.save(actions);
      adapter.close();
      console.log(`${label}: "${action.title}"`);
    });
}

stateCommand("go", "Start working on an action", "active", "Started");
stateCommand("stop", "Pause an active action", "open", "Stopped");
stateCommand("done", "Mark an action as done", "done", "Done");
stateCommand("donot", "Skip an action", "skipped", "Skipped");
stateCommand("redo", "Reopen a done or skipped action", "open", "Reopened");

// --- Ordering ---

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
    const adapter = new AutomergeAdapter(dbPath());
    const actions = adapter.load();
    const priorities = adapter.loadPriorities();
    const resolved = ids.map((prefix) => findAction(actions, prefix));
    try {
      resolved.reduce((prev, curr) => {
        addPrerequisite(actions, priorities, prev.id, curr.id);
        return curr;
      });
    } catch (e) {
      adapter.close();
      console.error((e as Error).message);
      process.exit(1);
    }
    adapter.save(actions);
    adapter.close();
    console.log(`Added prerequisite(s)`);
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
    const adapter = new AutomergeAdapter(dbPath());
    const actions = adapter.load();
    const resolved = ids.map((prefix) => findAction(actions, prefix));
    const priorities = adapter.loadPriorities();
    try {
      resolved.reduce((prev, curr) => {
        addPriority(actions, priorities, prev.id, curr.id);
        return curr;
      });
    } catch (e) {
      adapter.close();
      console.error((e as Error).message);
      process.exit(1);
    }
    adapter.savePriorities(priorities);
    adapter.close();
    console.log(`Added priority relation(s)`);
  });

program
  .command("unreq")
  .description("Remove prerequisites: acto unreq A B C removes A→B and B→C")
  .argument("<ids...>", "Action IDs (or prefixes) in work order")
  .action((ids: string[]) => {
    if (ids.length < 2) {
      console.error("Need at least two action IDs");
      process.exit(1);
    }
    const adapter = new AutomergeAdapter(dbPath());
    const actions = adapter.load();
    const resolved = ids.map((prefix) => findAction(actions, prefix));
    try {
      resolved.reduce((prev, curr) => {
        removePrerequisite(actions, prev.id, curr.id);
        return curr;
      });
    } catch (e) {
      adapter.close();
      console.error((e as Error).message);
      process.exit(1);
    }
    adapter.save(actions);
    adapter.close();
    console.log(`Removed prerequisite(s)`);
  });

program
  .command("unprio")
  .description("Remove priorities: acto unprio A B C removes A>B and B>C")
  .argument("<ids...>", "Action IDs (or prefixes) in priority order")
  .action((ids: string[]) => {
    if (ids.length < 2) {
      console.error("Need at least two action IDs");
      process.exit(1);
    }
    const adapter = new AutomergeAdapter(dbPath());
    const actions = adapter.load();
    const resolved = ids.map((prefix) => findAction(actions, prefix));
    const priorities = adapter.loadPriorities();
    try {
      resolved.reduce((prev, curr) => {
        removePriority(priorities, prev.id, curr.id);
        return curr;
      });
    } catch (e) {
      adapter.close();
      console.error((e as Error).message);
      process.exit(1);
    }
    adapter.savePriorities(priorities);
    adapter.close();
    console.log(`Removed priority relation(s)`);
  });

program.parse();
