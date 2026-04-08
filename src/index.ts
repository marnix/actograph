// index.ts - CLI entry point

import { Command } from "commander";
import { randomUUID } from "crypto";
import { generateSlug } from "./domain/action-id.js";
import { findAction } from "./cli/find-action.js";
import {
  buildAnnotations,
  formatActionLabel,
  formatTagLabel,
} from "./cli/list-format.js";
import type { ActionState } from "./domain/action.js";
import {
  transitionAction,
  createAction,
  validateNewAction,
} from "./domain/action.js";
import { isTagTitle } from "./domain/tags.js";
import {
  computeWorkOrder,
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
      const annotations = buildAnnotations(tagActions, tagActions, priorities);
      const graph = computeWorkOrder(tagActions, priorities);
      const sp = spDecompose(graph);
      const tagMap = new Map(tagActions.map((a) => [a.uuid, a]));
      const output = renderSP(sp, (uuid) => {
        const a = tagMap.get(uuid);
        return a ? formatTagLabel(a, annotations) : uuid;
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
    const annotations = buildAnnotations(visible, actions, priorities);
    const graph = computeWorkOrder(
      visible,
      priorities,
      opts.all ? undefined : actions,
    );
    const sp = spDecompose(graph);
    const actionMap = new Map(visible.map((a) => [a.uuid, a]));
    const output = renderSP(sp, (uuid) => {
      const a = actionMap.get(uuid);
      return a ? formatActionLabel(a, annotations) : uuid;
    });
    console.log(output);
  });

program
  .command("do")
  .description("Add a new action")
  .argument("<title>", "Action title")
  .action((title: string) => {
    const adapter = new AutomergeAdapter(dbPath());
    adapter.transact(({ actions, priorities }) => {
      try {
        validateNewAction(title, actions);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
      actions.push(
        createAction(
          randomUUID(),
          generateSlug((s) => actions.every((a) => a.slug !== s)),
          title,
        ),
      );
      console.log(`Added: "${title}" (${actions.length} actions total)`);
      return { actions, priorities };
    });
    adapter.close();
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
    .argument("<slug>", "Action slug (or prefix)")
    .action((slugPrefix: string) => {
      const adapter = new AutomergeAdapter(dbPath());
      adapter.transact(({ actions, priorities }) => {
        try {
          const action = findAction(actions, slugPrefix);
          transitionAction(action, newState);
          console.log(`${label}: "${action.title}"`);
        } catch (e) {
          console.error((e as Error).message);
          process.exit(1);
        }
        return { actions, priorities };
      });
      adapter.close();
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
  .argument("<slugs...>", "Action slugs (or prefixes) in work order")
  .action((slugs: string[]) => {
    if (slugs.length < 2) {
      console.error("Need at least two action slugs");
      process.exit(1);
    }
    const adapter = new AutomergeAdapter(dbPath());
    adapter.transact(({ actions, priorities }) => {
      try {
        const resolved = slugs.map((prefix) => findAction(actions, prefix));
        resolved.reduce((prev, curr) => {
          addPrerequisite(actions, priorities, prev.uuid, curr.uuid);
          return curr;
        });
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
      console.log(`Added prerequisite(s)`);
      return { actions, priorities };
    });
    adapter.close();
  });

program
  .command("prio")
  .description(
    "Set priorities: acto prio A B C means A has priority over B, B has priority over C",
  )
  .argument("<slugs...>", "Action slugs (or prefixes) in priority order")
  .action((slugs: string[]) => {
    if (slugs.length < 2) {
      console.error("Need at least two action slugs");
      process.exit(1);
    }
    const adapter = new AutomergeAdapter(dbPath());
    adapter.transact(({ actions, priorities }) => {
      try {
        const resolved = slugs.map((prefix) => findAction(actions, prefix));
        resolved.reduce((prev, curr) => {
          addPriority(actions, priorities, prev.uuid, curr.uuid);
          return curr;
        });
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
      console.log(`Added priority relation(s)`);
      return { actions, priorities };
    });
    adapter.close();
  });

program
  .command("unreq")
  .description("Remove prerequisites: acto unreq A B C removes A→B and B→C")
  .argument("<slugs...>", "Action slugs (or prefixes) in work order")
  .action((slugs: string[]) => {
    if (slugs.length < 2) {
      console.error("Need at least two action slugs");
      process.exit(1);
    }
    const adapter = new AutomergeAdapter(dbPath());
    adapter.transact(({ actions, priorities }) => {
      try {
        const resolved = slugs.map((prefix) => findAction(actions, prefix));
        resolved.reduce((prev, curr) => {
          removePrerequisite(actions, prev.uuid, curr.uuid);
          return curr;
        });
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
      console.log(`Removed prerequisite(s)`);
      return { actions, priorities };
    });
    adapter.close();
  });

program
  .command("unprio")
  .description("Remove priorities: acto unprio A B C removes A>B and B>C")
  .argument("<slugs...>", "Action slugs (or prefixes) in priority order")
  .action((slugs: string[]) => {
    if (slugs.length < 2) {
      console.error("Need at least two action slugs");
      process.exit(1);
    }
    const adapter = new AutomergeAdapter(dbPath());
    adapter.transact(({ actions, priorities }) => {
      try {
        const resolved = slugs.map((prefix) => findAction(actions, prefix));
        resolved.reduce((prev, curr) => {
          removePriority(priorities, prev.uuid, curr.uuid);
          return curr;
        });
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
      console.log(`Removed priority relation(s)`);
      return { actions, priorities };
    });
    adapter.close();
  });

program.parse();
