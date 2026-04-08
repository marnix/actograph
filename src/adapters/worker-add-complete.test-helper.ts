// Child process script: performs one add-then-complete cycle against a shared db file.
// Outputs "uuid:contentionCount" to stdout.
//
// NOTE: cannot import domain modules here because --experimental-strip-types
// does not resolve .js extensions in transitive imports.
import { randomUUID } from "crypto";
import { AutomergeAdapter } from "./automerge-adapter.ts";

const [dbPath, index] = process.argv.slice(2);

const uuid = randomUUID();
const adapter = new AutomergeAdapter(dbPath!);

adapter.transact(({ actions, priorities }) => ({
  actions: [
    ...actions,
    {
      uuid,
      slug: `task-${index}`,
      title: `task-${index}`,
      state: "open" as const,
      prerequisites: [],
    },
  ],
  priorities,
}));

adapter.transact(({ actions, priorities }) => {
  const action = actions.find((a) => a.uuid === uuid);
  if (!action) throw new Error(`Action ${uuid} not found after add`);
  action.state = "done";
  return { actions, priorities };
});

process.stdout.write(`${uuid}:${adapter.contentionCount}`);
