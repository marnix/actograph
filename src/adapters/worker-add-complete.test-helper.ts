// Child process script: performs one add-then-complete cycle against a shared db file.
// Outputs "id:contentionCount" to stdout.
import { randomUUID } from "crypto";
import { AutomergeAdapter } from "./automerge-adapter.ts";

const [dbPath, index] = process.argv.slice(2);

const id = randomUUID();
const adapter = new AutomergeAdapter(dbPath!);

adapter.transact(({ actions, priorities }) => ({
  actions: [
    ...actions,
    { id, title: `task-${index}`, state: "open" as const, prerequisites: [] },
  ],
  priorities,
}));

adapter.transact(({ actions, priorities }) => {
  const action = actions.find((a) => a.id === id);
  if (!action) throw new Error(`Action ${id} not found after add`);
  action.state = "done";
  return { actions, priorities };
});

process.stdout.write(`${id}:${adapter.contentionCount}`);
