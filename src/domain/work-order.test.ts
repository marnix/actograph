import { describe, it, expect } from "vitest";
import {
  computeWorkOrder,
  addPrerequisite,
  addPriority,
  removePrerequisite,
  removePriority,
} from "./work-order.js";
import type { Priority } from "./priority.js";

function action(id: string, ...prereqIds: string[]) {
  return {
    id,
    prerequisites: prereqIds.map((actionId) => ({ actionId, createdAt: 0 })),
  };
}

function edges(graph: ReturnType<typeof computeWorkOrder>): string[] {
  return graph
    .mapEdges((_e, _a, source, target) => `${source}->${target}`)
    .sort();
}

describe("computeWorkOrder", () => {
  it("no actions, empty graph", () => {
    const g = computeWorkOrder([], []);
    expect(g.order).toBe(0);
    expect(g.size).toBe(0);
  });

  it("single action, no edges", () => {
    const g = computeWorkOrder([action("a")], []);
    expect(g.order).toBe(1);
    expect(g.size).toBe(0);
  });

  it("two unrelated actions, no edges", () => {
    const g = computeWorkOrder([action("a"), action("b")], []);
    expect(edges(g)).toEqual([]);
  });

  it("direct prerequisite: a required by b", () => {
    const g = computeWorkOrder([action("a"), action("b", "a")], []);
    expect(edges(g)).toEqual(["a->b"]);
  });

  it("transitive prerequisite: a->b->c", () => {
    const g = computeWorkOrder(
      [action("a"), action("b", "a"), action("c", "b")],
      [],
    );
    // Only direct edges, no transitive a->c
    expect(edges(g)).toEqual(["a->b", "b->c"]);
  });

  it("direct priority: a over b", () => {
    const prios: Priority[] = [{ higher: "a", lower: "b", createdAt: 0 }];
    const g = computeWorkOrder([action("a"), action("b")], prios);
    expect(edges(g)).toEqual(["a->b"]);
  });

  it("transitive priority: a over b over c", () => {
    const prios: Priority[] = [
      { higher: "a", lower: "b", createdAt: 0 },
      { higher: "b", lower: "c", createdAt: 0 },
    ];
    const g = computeWorkOrder([action("a"), action("b"), action("c")], prios);
    expect(edges(g)).toEqual(["a->b", "b->c"]);
  });

  it("priority does not override reverse dependency", () => {
    // a has prio over b, but b is required by a → b must come first
    const prios: Priority[] = [{ higher: "a", lower: "b", createdAt: 0 }];
    const g = computeWorkOrder([action("a", "b"), action("b")], prios);
    // b before a (req), a NOT before b (prio blocked by reverse req)
    expect(edges(g)).toEqual(["b->a"]);
  });

  it("mixed: prereq and priority on different pairs", () => {
    // a required by b, c has prio over a
    const prios: Priority[] = [{ higher: "c", lower: "a", createdAt: 0 }];
    const g = computeWorkOrder(
      [action("a"), action("b", "a"), action("c")],
      prios,
    );
    // c->a (prio, no reverse req), a->b (req)
    // c is NOT before b: c is not req-reachable to b, and not prio-reachable to b
    expect(edges(g)).toEqual(["a->b", "c->a"]);
  });

  it("prio edge dropped when it would create a cycle with req", () => {
    // req: a->b, prio: c->a (oldest) and b->c (newest)
    // Adding both prios would create a->b->c->a cycle.
    // Oldest prio (c->a) wins, newest (b->c) is dropped.
    const prios: Priority[] = [
      { higher: "c", lower: "a", createdAt: 1 },
      { higher: "b", lower: "c", createdAt: 2 },
    ];
    const g = computeWorkOrder(
      [action("a"), action("b", "a"), action("c")],
      prios,
    );
    expect(edges(g)).toEqual(["a->b", "c->a"]);
  });

  it("diamond prerequisite: a->b, a->c, b->d, c->d", () => {
    const g = computeWorkOrder(
      [action("a"), action("b", "a"), action("c", "a"), action("d", "b", "c")],
      [],
    );
    expect(edges(g)).toEqual(["a->b", "a->c", "b->d", "c->d"]);
  });

  it("transitive through hidden: a->B->c preserves a->c", () => {
    // B is done/hidden, but a should still come before c
    const all = [action("a"), action("b", "a"), action("c", "b")];
    const visible = [action("a"), action("c", "b")];
    const g = computeWorkOrder(visible, [], all);
    expect(edges(g)).toEqual(["a->c"]);
  });

  it("transitive through multiple hidden: a->B->C->d", () => {
    const all = [
      action("a"),
      action("b", "a"),
      action("c", "b"),
      action("d", "c"),
    ];
    const visible = [action("a"), action("d", "c")];
    const g = computeWorkOrder(visible, [], all);
    expect(edges(g)).toEqual(["a->d"]);
  });

  it("hidden node fans out: a->B, B->c, B->d", () => {
    const all = [
      action("a"),
      action("b", "a"),
      action("c", "b"),
      action("d", "b"),
    ];
    const visible = [action("a"), action("c", "b"), action("d", "b")];
    const g = computeWorkOrder(visible, [], all);
    expect(edges(g)).toEqual(["a->c", "a->d"]);
  });

  it("hidden priority: a >B> c preserves a->c", () => {
    const all = [action("a"), action("b"), action("c")];
    const visible = [action("a"), action("c")];
    const prios: Priority[] = [
      { higher: "a", lower: "b", createdAt: 0 },
      { higher: "b", lower: "c", createdAt: 0 },
    ];
    const g = computeWorkOrder(visible, prios, all);
    expect(edges(g)).toEqual(["a->c"]);
  });

  it("no hidden actions: allActions param is optional", () => {
    const g = computeWorkOrder([action("a"), action("b", "a")], []);
    expect(edges(g)).toEqual(["a->b"]);
  });
});

function fullAction(id: string, ...prereqIds: string[]) {
  return {
    id,
    title: id,
    state: "open" as const,
    prerequisites: prereqIds.map((actionId) => ({ actionId, createdAt: 0 })),
  };
}

describe("addPrerequisite", () => {
  it("adds a prerequisite", () => {
    const actions = [fullAction("a"), fullAction("b")];
    addPrerequisite(actions, [], "a", "b");
    const b = actions.find((a) => a.id === "b")!;
    expect(b.prerequisites).toEqual(
      expect.arrayContaining([expect.objectContaining({ actionId: "a" })]),
    );
  });

  it("is idempotent", () => {
    const actions = [fullAction("a"), fullAction("b", "a")];
    addPrerequisite(actions, [], "a", "b");
    const b = actions.find((a) => a.id === "b")!;
    expect(b.prerequisites.filter((p) => p.actionId === "a")).toHaveLength(1);
  });

  it("throws on cycle", () => {
    const actions = [fullAction("a"), fullAction("b", "a")];
    expect(() => addPrerequisite(actions, [], "b", "a")).toThrow("cycle");
  });

  it("throws on unknown target", () => {
    expect(() => addPrerequisite([fullAction("a")], [], "a", "z")).toThrow(
      "Action not found",
    );
  });
});

describe("addPriority", () => {
  it("adds a priority", () => {
    const prios: Priority[] = [];
    addPriority([fullAction("a"), fullAction("b")], prios, "a", "b");
    expect(prios).toHaveLength(1);
    expect(prios[0]).toEqual(
      expect.objectContaining({ higher: "a", lower: "b" }),
    );
  });

  it("is idempotent", () => {
    const prios: Priority[] = [{ higher: "a", lower: "b", createdAt: 0 }];
    addPriority([fullAction("a"), fullAction("b")], prios, "a", "b");
    expect(prios).toHaveLength(1);
  });

  it("throws on cycle", () => {
    const actions = [fullAction("a"), fullAction("b", "a")];
    expect(() => addPriority(actions, [], "b", "a")).toThrow("cycle");
  });
});

describe("removePrerequisite", () => {
  it("removes an existing prerequisite", () => {
    const actions = [fullAction("a"), fullAction("b", "a")];
    removePrerequisite(actions, "a", "b");
    const b = actions.find((a) => a.id === "b")!;
    expect(b.prerequisites).toHaveLength(0);
  });

  it("throws when prerequisite does not exist", () => {
    const actions = [fullAction("a"), fullAction("b")];
    expect(() => removePrerequisite(actions, "a", "b")).toThrow(
      "No prerequisite",
    );
  });

  it("throws on unknown target", () => {
    expect(() => removePrerequisite([fullAction("a")], "a", "z")).toThrow(
      "Action not found",
    );
  });
});

describe("removePriority", () => {
  it("removes an existing priority", () => {
    const prios: Priority[] = [{ higher: "a", lower: "b", createdAt: 0 }];
    removePriority(prios, "a", "b");
    expect(prios).toHaveLength(0);
  });

  it("throws when priority does not exist", () => {
    expect(() => removePriority([], "a", "b")).toThrow("No priority");
  });
});
