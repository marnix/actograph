import { describe, it, expect } from "vitest";
import type { Action } from "./action.js";

describe("Action", () => {
  it("should create an action with title and completed status", () => {
    const action: Action = {
      id: "test-1",
      title: "Test action",
      completed: false,
    };

    expect(action.title).toBe("Test action");
    expect(action.completed).toBe(false);
    expect(action.id).toBe("test-1");
  });
});
