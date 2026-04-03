// Child process script: performs one add-then-complete cycle against a shared db file.
// Run as: node --experimental-strip-types worker-add-complete.ts <dbPath> <index>
import { randomUUID } from "crypto";
import { AutomergeAdapter } from "./automerge-adapter.ts";

const [dbPath, index] = process.argv.slice(2);

const id = randomUUID();
const adapter = new AutomergeAdapter(dbPath);

adapter.transact((actions) => [
  ...actions,
  { id, title: `task-${index}`, completed: false },
]);

adapter.transact((actions) => {
  const action = actions.find((a) => a.id === id);
  if (!action) throw new Error(`Action ${id} not found after add`);
  action.completed = true;
  return actions;
});

process.stdout.write(id);
