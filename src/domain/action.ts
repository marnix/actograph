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

/** Validate that a new action can be added to the existing set. */
export function validateNewAction(title: string, existing: Action[]): void {
  if (isTagTitle(title) && existing.some((a) => a.title === title)) {
    throw new Error(`Tag action "${title}" already exists`);
  }
}

/** Update an action's title. Tag actions cannot be edited. */
export function editAction(action: Action, newTitle: string): void {
  if (isTagTitle(action.title)) {
    throw new Error(`Cannot edit tag action "${action.title}"`);
  }
  if (isTagTitle(newTitle)) {
    throw new Error(`Cannot change action to a tag-only title`);
  }
  action.title = newTitle;
}
