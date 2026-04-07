import { describe, it, expect } from "vitest";
import type { Action } from "./action.js";

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
