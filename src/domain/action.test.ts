import { describe, it, expect } from "vitest";
import type { Action, ActionState } from "./action.js";
import { canTransition } from "./action.js";

describe("Action", () => {
  it("should create an action with title and state", () => {
    const action: Action = {
      id: "test-1",
      title: "Test action",
      state: "open",
      prerequisites: [],
    };

    expect(action.title).toBe("Test action");
    expect(action.state).toBe("open");
    expect(action.id).toBe("test-1");
  });
});

describe("canTransition", () => {
  const allowed: [ActionState, ActionState][] = [
    ["open", "active"],
    ["open", "done"],
    ["open", "skipped"],
    ["active", "open"],
    ["active", "done"],
    ["active", "skipped"],
    ["done", "open"],
    ["skipped", "open"],
  ];

  it.each(allowed)("%s → %s is allowed", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  const forbidden: [ActionState, ActionState][] = [
    ["open", "open"],
    ["active", "active"],
    ["done", "done"],
    ["done", "active"],
    ["done", "skipped"],
    ["skipped", "skipped"],
    ["skipped", "active"],
    ["skipped", "done"],
  ];

  it.each(forbidden)("%s → %s is forbidden", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});
