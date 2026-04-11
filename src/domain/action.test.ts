import { describe, it, expect } from "vitest";
import type { Action, ActionState } from "./action.js";
import {
  canTransition,
  transitionAction,
  createAction,
  validateNewAction,
  editAction,
} from "./action.js";

describe("Action", () => {
  it("should create an action with title and state", () => {
    const action = createAction("u1", "test-1", "Test action");

    expect(action.title).toBe("Test action");
    expect(action.state).toBe("open");
    expect(action.slug).toBe("test-1");
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
  function makeAction(state: ActionState, title = "test"): Action {
    const a = createAction("u1", "t", title);
    a.state = state;
    return a;
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

  const allTargetStates: ActionState[] = ["open", "active", "done", "skipped"];

  it.each(allTargetStates)(
    "throws on tag action for any target state (%s)",
    (target) => {
      const a = makeAction("open", "++urgent");
      expect(() => transitionAction(a, target)).toThrow(
        'Cannot change state of tag action "++urgent"',
      );
      expect(a.state).toBe("open");
    },
  );
});

describe("validateNewAction", () => {
  it("allows duplicate non-tag titles", () => {
    const existing = [createAction("u1", "s1", "Fix bug")];
    expect(() => validateNewAction("Fix bug", existing)).not.toThrow();
  });

  it("allows first tag action", () => {
    expect(() => validateNewAction("++urgent", [])).not.toThrow();
  });

  it("rejects duplicate tag action", () => {
    const existing = [createAction("u1", "s1", "++urgent")];
    expect(() => validateNewAction("++urgent", existing)).toThrow(
      'Tag action "++urgent" already exists',
    );
  });
});

describe("editAction", () => {
  it("updates the title", () => {
    const a = createAction("u1", "s1", "Old title");
    editAction(a, "New title");
    expect(a.title).toBe("New title");
  });

  it("allows adding tag tokens to a normal title", () => {
    const a = createAction("u1", "s1", "Fix bug");
    editAction(a, "Fix bug ++urgent");
    expect(a.title).toBe("Fix bug ++urgent");
  });

  it("rejects editing a tag action", () => {
    const a = createAction("u1", "s1", "++urgent");
    expect(() => editAction(a, "renamed")).toThrow(
      'Cannot edit tag action "++urgent"',
    );
    expect(a.title).toBe("++urgent");
  });

  it("rejects changing to a tag-only title", () => {
    const a = createAction("u1", "s1", "Fix bug");
    expect(() => editAction(a, "++urgent")).toThrow(
      "Cannot change action to a tag-only title",
    );
    expect(a.title).toBe("Fix bug");
  });
});
