import { describe, it, expect } from "vitest";
import type { Action, ActionState } from "./action.js";
import { canTransition, transitionAction } from "./action.js";

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

describe("transitionAction", () => {
  function makeAction(state: ActionState): Action {
    return { id: "t", title: "test", state, prerequisites: [] };
  }

  it("mutates state on valid transition", () => {
    const a = makeAction("open");
    transitionAction(a, "active");
    expect(a.state).toBe("active");
  });

  it("throws on invalid transition", () => {
    const a = makeAction("done");
    expect(() => transitionAction(a, "active")).toThrow(
      'Cannot transition from "done" to "active"',
    );
  });

  it("does not mutate state on invalid transition", () => {
    const a = makeAction("done");
    try {
      transitionAction(a, "active");
    } catch {
      /* expected */
    }
    expect(a.state).toBe("done");
  });
});
