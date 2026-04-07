// Action domain entity - plain TypeScript, no framework dependency

export interface Prerequisite {
  actionId: string;
  createdAt: number; // milliseconds since epoch
}

export type ActionState = "open" | "active" | "done" | "skipped";

export interface Action {
  id: string;
  title: string;
  state: ActionState;
  prerequisites: Prerequisite[];
}
