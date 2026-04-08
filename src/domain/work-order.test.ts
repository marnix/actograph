import { describe, it, expect } from "vitest";
import {
  computeWorkOrder,
  addPrerequisite,
  addPriority,
  removePrerequisite,
  removePriority,
} from "./work-order.js";
import { createAction } from "./action.js";
import type { Priority } from "./priority.js";

function action(uuid: string, ...prereqUuids: string[]) {
  return {
    uuid,
    title: uuid,
    prerequisites: prereqUuids.map((u) => ({ uuid: u, createdAt: 0 })),
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
    const prios: Priority[] = [{ higher: "a", lower: "b", createdAt: 0 }];
    const g = computeWorkOrder([action("a", "b"), action("b")], prios);
    expect(edges(g)).toEqual(["b->a"]);
  });

  it("mixed: prereq and priority on different pairs", () => {
    const prios: Priority[] = [{ higher: "c", lower: "a", createdAt: 0 }];
    const g = computeWorkOrder(
      [action("a"), action("b", "a"), action("c")],
      prios,
    );
    expect(edges(g)).toEqual(["a->b", "c->a"]);
  });

  it("prio edge dropped when it would create a cycle with req", () => {
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

function fullAction(uuid: string, ...prereqUuids: string[]) {
  const a = createAction(uuid, uuid, uuid);
  a.prerequisites = prereqUuids.map((u) => ({ uuid: u, createdAt: 0 }));
  return a;
}

describe("addPrerequisite", () => {
  it("adds a prerequisite", () => {
    const actions = [fullAction("a"), fullAction("b")];
    addPrerequisite(actions, [], "a", "b");
    const b = actions.find((a) => a.uuid === "b")!;
    expect(b.prerequisites).toEqual(
      expect.arrayContaining([expect.objectContaining({ uuid: "a" })]),
    );
  });

  it("is idempotent", () => {
    const actions = [fullAction("a"), fullAction("b", "a")];
    addPrerequisite(actions, [], "a", "b");
    const b = actions.find((a) => a.uuid === "b")!;
    expect(b.prerequisites.filter((p) => p.uuid === "a")).toHaveLength(1);
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
    const b = actions.find((a) => a.uuid === "b")!;
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

describe("tag inheritance via expandTagRelations", () => {
  function makeTagAction(uuid: string, tag: string, ...prereqUuids: string[]) {
    const a = fullAction(uuid, ...prereqUuids);
    a.title = `++${tag}`;
    return a;
  }

  function makeTaggedAction(
    uuid: string,
    title: string,
    ...prereqUuids: string[]
  ) {
    const a = fullAction(uuid, ...prereqUuids);
    a.title = title;
    return a;
  }

  it("tagged action inherits prerequisites from tag action", () => {
    const prereqAction = fullAction("prereq");
    const tagAct = makeTagAction("t1", "urgent", "prereq");
    const tagged = makeTaggedAction("a1", "Fix bug ++urgent");
    const actions = [prereqAction, tagAct, tagged];
    const g = computeWorkOrder(actions, []);
    expect(edges(g)).toContain("prereq->a1");
  });

  it("prio between tag actions expands to member actions", () => {
    const tagUrgent = makeTagAction("t1", "urgent");
    const tagBacklog = makeTagAction("t2", "backlog");
    const urgentAction = makeTaggedAction("a1", "Fix bug ++urgent");
    const backlogAction = makeTaggedAction("a2", "Refactor ++backlog");
    const actions = [tagUrgent, tagBacklog, urgentAction, backlogAction];
    const prios: Priority[] = [{ higher: "t1", lower: "t2", createdAt: 0 }];
    const g = computeWorkOrder(actions, prios);
    expect(edges(g)).toContain("a1->a2");
  });

  it("tag prio does not create self-edges", () => {
    const tagUrgent = makeTagAction("t1", "urgent");
    const a1 = makeTaggedAction("a1", "Fix ++urgent");
    const actions = [tagUrgent, a1];
    const prios: Priority[] = [{ higher: "t1", lower: "t1", createdAt: 0 }];
    const g = computeWorkOrder(actions, prios);
    expect(g.size).toBe(0);
  });

  it("action with multiple tags inherits from all", () => {
    const prereq1 = fullAction("p1");
    const prereq2 = fullAction("p2");
    const tag1 = makeTagAction("t1", "urgent", "p1");
    const tag2 = makeTagAction("t2", "v2", "p2");
    const multi = makeTaggedAction("a1", "Fix ++urgent ++v2");
    const actions = [prereq1, prereq2, tag1, tag2, multi];
    const g = computeWorkOrder(actions, []);
    expect(edges(g)).toContain("p1->a1");
    expect(edges(g)).toContain("p2->a1");
  });

  it("non-tag actions are unaffected", () => {
    const tagAct = makeTagAction("t1", "urgent");
    const plain = fullAction("a1");
    const actions = [tagAct, plain];
    const prios: Priority[] = [{ higher: "t1", lower: "a1", createdAt: 0 }];
    const g = computeWorkOrder(actions, prios);
    expect(edges(g)).toContain("t1->a1");
  });

  it("tag prio expands when visible excludes tags but allActions includes them", () => {
    const tagUrgent = makeTagAction("t1", "urgent");
    const tagNice = makeTagAction("t2", "nicetohave");
    const a1 = makeTaggedAction("a1", "Fix ++urgent");
    const a2 = makeTaggedAction("a2", "Polish ++nicetohave");
    const all = [tagUrgent, tagNice, a1, a2];
    const visible = [a1, a2];
    const prios: Priority[] = [{ higher: "t1", lower: "t2", createdAt: 0 }];
    const g = computeWorkOrder(visible, prios, all);
    expect(g.hasEdge("a1", "a2")).toBe(true);
  });

  it("tag prio preserved in --all with done prereq", () => {
    // Mirrors: Design(done) -> Implement -> Test -> Deploy,
    // with ++urgent on "Fix" and ++nicetohave on "Docs",
    // and tag prio urgent > nicetohave
    const tagUrgent = makeTagAction("t1", "urgent");
    const tagNice = makeTagAction("t2", "nicetohave");
    const design = fullAction("design");
    design.title = "Design";
    design.state = "done";
    const impl = makeTaggedAction("impl", "Implement ++urgent", "design");
    const docs = makeTaggedAction("docs", "Docs ++nicetohave");
    const all = [tagUrgent, tagNice, design, impl, docs];
    const visible = [design, impl, docs]; // --all: includes done, excludes tags
    const prios: Priority[] = [{ higher: "t1", lower: "t2", createdAt: 0 }];
    const g = computeWorkOrder(visible, prios, all);
    // impl (urgent) should have priority over docs (nicetohave)
    expect(g.hasEdge("impl", "docs")).toBe(true);
  });
});
