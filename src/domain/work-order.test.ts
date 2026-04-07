import { describe, it, expect } from "vitest";
import { computeWorkOrder } from "./work-order.js";
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
});
