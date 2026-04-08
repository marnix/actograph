// Action domain entity - plain TypeScript, no framework dependency

import { isTagTitle } from "./tags.js";

export interface Prerequisite {
  uuid: string;
  createdAt: number; // milliseconds since epoch
}

export const ACTION_STATES = ["open", "active", "done", "skipped"] as const;
export type ActionState = (typeof ACTION_STATES)[number];

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
  if (isTagTitle(action.title)) {
    throw new Error(`Cannot change state of tag action "${action.title}"`);
  }
  if (!canTransition(action.state, to)) {
    throw new Error(`Cannot transition from "${action.state}" to "${to}"`);
  }
  action.state = to;
}

export interface Action {
  uuid: string;
  slug: string;
  title: string;
  state: ActionState;
  prerequisites: Prerequisite[];
}

/** Create a new action with state "open" and no prerequisites. */
export function createAction(
  uuid: string,
  slug: string,
  title: string,
): Action {
  return { uuid, slug, title, state: "open", prerequisites: [] };
}
