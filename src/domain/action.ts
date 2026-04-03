// Action schema - domain entity
import { co, z } from "jazz-tools";

export const Action = co.map({
  title: z.string(),
  completed: z.boolean(),
});

export type Action = co.loaded<typeof Action>;
