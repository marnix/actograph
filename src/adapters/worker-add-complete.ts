// Worker script: performs one add-then-complete cycle against a shared db file.
import { workerData, parentPort } from "worker_threads";
import { randomUUID } from "crypto";
import { AutomergeAdapter } from "./automerge-adapter.ts";

const { dbPath, index } = workerData as { dbPath: string; index: number };

const id = randomUUID();
const title = `task-${index}`;

// add
{
  const adapter = new AutomergeAdapter(dbPath);
  const actions = adapter.load();
  actions.push({ id, title, completed: false });
  adapter.save(actions);
  adapter.close();
}

// complete
{
  const adapter = new AutomergeAdapter(dbPath);
  const actions = adapter.load();
  const action = actions.find((a) => a.id === id);
  if (!action) throw new Error(`Action ${id} not found after add`);
  action.completed = true;
  adapter.save(actions);
  adapter.close();
}

parentPort!.postMessage(id);
