// Action domain entity - plain TypeScript, no framework dependency

export interface Prerequisite {
  actionId: string;
  createdAt: number; // milliseconds since epoch
}

export type ActionState = "open" | "active" | "done" | "skipped";

const validTransitions: Record<ActionState, ActionState[]> = {
  open: ["active", "done", "skipped"],
  active: ["open", "done", "skipped"],
  done: ["open"],
  skipped: ["open"],
};

export function canTransition(from: ActionState, to: ActionState): boolean {
  return validTransitions[from].includes(to);
}

export function transitionAction(action: Action, to: ActionState): void {
  if (!canTransition(action.state, to)) {
    throw new Error(`Cannot transition from "${action.state}" to "${to}"`);
  }
  action.state = to;
}

export interface Action {
  id: string;
  title: string;
  state: ActionState;
  prerequisites: Prerequisite[];
}
