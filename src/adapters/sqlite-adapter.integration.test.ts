import { describe, it, expect, beforeEach } from "vitest";
import { setupJazzTestSync, createJazzTestAccount } from "jazz-tools/testing";
import { co, Account, CoMap } from "jazz-tools";
import { Action } from "../domain/action.js";

class TestAccount extends Account {
  root = co.ref(CoMap);
}

describe("Jazz Concurrent Access Integration", () => {
  beforeEach(async () => {
    await setupJazzTestSync();
  });

  it("should handle 10 parallel action creations", async () => {
    // Create 10 accounts in parallel
    const accounts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        createJazzTestAccount({
          AccountSchema: TestAccount,
          isCurrentActiveAccount: i === 0,
        })
      )
    );

    // Create 10 actions in parallel, each from a different account
    const createPromises = accounts.map((account, i) =>
      Action.create(
        {
          title: `Action ${i + 1}`,
          completed: false,
        },
        { owner: account }
      )
    );

    const actions = await Promise.all(createPromises);

    // Verify all 10 actions were created successfully
    expect(actions).toHaveLength(10);
    actions.forEach((action, i) => {
      expect(action.title).toBe(`Action ${i + 1}`);
      expect(action.completed).toBe(false);
    });
  });
});
