// End-to-end tests for the `acto list` pipeline:
//
// Conceptual algorithm:
// 1. Build a directed graph from all actions using prereq and prio edges
// 2. Contract (remove) hidden nodes — those not in `visible` — by connecting
//    their in-neighbors directly to their out-neighbors
// 3. SP-decompose the resulting graph (Valdes-Tarjan-Lawler edge contraction,
//    with topological-layer fallback for N-patterns)
//
// "Hidden" nodes are:
// - Tag actions (always excluded from list and list -a)
// - Done/skipped actions (excluded unless -a)
// - Actions not matching the tag filter (for `list ++tag`)

import { describe, it, expect } from "vitest";
import type { Action } from "./action.js";
import type { Priority } from "./priority.js";
import { computeWorkOrder } from "./work-order.js";
import { spDecompose, type SPNode } from "./sp-decompose.js";

// --- Helpers ---

function makeAction(
  uuid: string,
  title: string,
  state: Action["state"] = "open",
  prereqs: string[] = [],
): Action {
  return {
    uuid,
    slug: uuid,
    title,
    state,
    prerequisites: prereqs.map((u) => ({ uuid: u, createdAt: 0 })),
  };
}

/** Run the list pipeline: computeWorkOrder → spDecompose. */
function listPipeline(
  visible: Action[],
  priorities: Priority[],
  allActions: Action[],
): SPNode {
  const graph = computeWorkOrder(visible, priorities, allActions);
  return spDecompose(graph);
}

/** Collect action ids from an SP tree in pre-order. */
function actionIds(node: SPNode): string[] {
  if (node.type === "action") return [node.id];
  return node.children.flatMap(actionIds);
}

// --- Tests ---

describe("list pipeline: basic (no hidden nodes)", () => {
  it("single open action → single action node", () => {
    const a = makeAction("a", "Do thing");
    const sp = listPipeline([a], [], [a]);
    expect(sp).toEqual({ type: "action", id: "a" });
  });

  it("two unrelated actions → parallel", () => {
    const a = makeAction("a", "Alpha");
    const b = makeAction("b", "Beta");
    const sp = listPipeline([a, b], [], [a, b]);
    expect(sp.type).toBe("par");
    expect(actionIds(sp).sort()).toEqual(["a", "b"]);
  });

  it("chain via prereqs: a→b→c → sequential", () => {
    const a = makeAction("a", "First");
    const b = makeAction("b", "Second", "open", ["a"]);
    const c = makeAction("c", "Third", "open", ["b"]);
    const all = [a, b, c];
    const sp = listPipeline(all, [], all);
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
        { type: "action", id: "c" },
      ],
    });
  });

  it("chain via priorities: a>b>c → sequential", () => {
    const a = makeAction("a", "High");
    const b = makeAction("b", "Med");
    const c = makeAction("c", "Low");
    const prios: Priority[] = [
      { higher: "a", lower: "b", createdAt: 0 },
      { higher: "b", lower: "c", createdAt: 1 },
    ];
    const all = [a, b, c];
    const sp = listPipeline(all, prios, all);
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
        { type: "action", id: "c" },
      ],
    });
  });

  it("diamond: a→b, a→c, b→d, c→d → seq(a, par(b,c), d)", () => {
    const a = makeAction("a", "Start");
    const b = makeAction("b", "Left", "open", ["a"]);
    const c = makeAction("c", "Right", "open", ["a"]);
    const d = makeAction("d", "End", "open", ["b", "c"]);
    const all = [a, b, c, d];
    const sp = listPipeline(all, [], all);
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        {
          type: "par",
          children: [
            { type: "action", id: "b" },
            { type: "action", id: "c" },
          ],
        },
        { type: "action", id: "d" },
      ],
    });
  });
});

describe("list pipeline: contraction of done/skipped actions", () => {
  it("done action in middle of chain is contracted: a→B(done)→c shows a→c", () => {
    const a = makeAction("a", "First");
    const b = makeAction("b", "Middle", "done", ["a"]);
    const c = makeAction("c", "Last", "open", ["b"]);
    const all = [a, b, c];
    const visible = [a, c]; // b is done, excluded from default list
    const sp = listPipeline(visible, [], all);
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "c" },
      ],
    });
  });

  it("skipped action contracted preserves ordering", () => {
    const a = makeAction("a", "First");
    const b = makeAction("b", "Skipped", "skipped", ["a"]);
    const c = makeAction("c", "Last", "open", ["b"]);
    const all = [a, b, c];
    const visible = [a, c];
    const sp = listPipeline(visible, [], all);
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "c" },
      ],
    });
  });

  it("multiple done actions in chain: a→B→C→d contracts to a→d", () => {
    const a = makeAction("a", "Start");
    const b = makeAction("b", "Done1", "done", ["a"]);
    const c = makeAction("c", "Done2", "done", ["b"]);
    const d = makeAction("d", "End", "open", ["c"]);
    const all = [a, b, c, d];
    const visible = [a, d];
    const sp = listPipeline(visible, [], all);
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "d" },
      ],
    });
  });

  it("done action with fan-out: a→B(done), B→c, B→d → a parallel to c,d with a→c, a→d", () => {
    const a = makeAction("a", "Root");
    const b = makeAction("b", "Hub", "done", ["a"]);
    const c = makeAction("c", "Left", "open", ["b"]);
    const d = makeAction("d", "Right", "open", ["b"]);
    const all = [a, b, c, d];
    const visible = [a, c, d];
    const sp = listPipeline(visible, [], all);
    // After contracting b: a→c, a→d → seq(a, par(c, d))
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        {
          type: "par",
          children: [
            { type: "action", id: "c" },
            { type: "action", id: "d" },
          ],
        },
      ],
    });
  });

  it("done action with fan-in: a→C(done), b→C(done), C→d → par(a,b)→d", () => {
    const a = makeAction("a", "Left");
    const b = makeAction("b", "Right");
    const c = makeAction("c", "Join", "done", ["a", "b"]);
    const d = makeAction("d", "End", "open", ["c"]);
    const all = [a, b, c, d];
    const visible = [a, b, d];
    const sp = listPipeline(visible, [], all);
    // After contracting c: a→d, b→d → seq(par(a,b), d)
    expect(sp).toEqual({
      type: "seq",
      children: [
        {
          type: "par",
          children: [
            { type: "action", id: "a" },
            { type: "action", id: "b" },
          ],
        },
        { type: "action", id: "d" },
      ],
    });
  });
});

describe("list pipeline: tag filtering (list ++tag)", () => {
  it("filters to only tagged actions, contracts untagged", () => {
    const tag = makeAction("t", "++proj");
    const a = makeAction("a", "Setup ++proj");
    const b = makeAction("b", "Unrelated work");
    const c = makeAction("c", "Deploy ++proj", "open", ["a", "b"]);
    const all = [tag, a, b, c];
    // list ++proj: visible = actions with ++proj tag, excluding tag action itself
    const visible = [a, c];
    const sp = listPipeline(visible, [], all);
    // b is contracted: a→c (via b being contracted, but also a is direct prereq of c)
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "c" },
      ],
    });
  });

  it("tag action itself is always hidden (contracted)", () => {
    const tag = makeAction("t", "++urgent");
    const a = makeAction("a", "Fix bug ++urgent");
    const b = makeAction("b", "Write test ++urgent");
    const all = [tag, a, b];
    const visible = [a, b]; // tag action excluded
    const sp = listPipeline(visible, [], all);
    // No edges between a and b → parallel
    expect(sp.type).toBe("par");
    expect(actionIds(sp).sort()).toEqual(["a", "b"]);
  });

  it("tag inheritance: tag prereq creates ordering among tagged actions", () => {
    // Tag ++proj requires action "setup" to be done first
    const setup = makeAction("setup", "Setup infra");
    const tag = makeAction("t", "++proj", "open", ["setup"]);
    const a = makeAction("a", "Build ++proj");
    const b = makeAction("b", "Deploy ++proj");
    const all = [setup, tag, a, b];
    // list ++proj: visible = [a, b], allActions = all
    // Tag inheritance: a and b both inherit prereq on "setup"
    // But setup is not in visible → contracted
    // After contraction: no edges between a and b (both just had setup as prereq)
    const visible = [a, b];
    const sp = listPipeline(visible, [], all);
    expect(sp.type).toBe("par");
    expect(actionIds(sp).sort()).toEqual(["a", "b"]);
  });

  it("tag priority inheritance creates ordering between tagged actions", () => {
    const tagUrg = makeAction("tu", "++urgent");
    const tagLater = makeAction("tl", "++later");
    const a = makeAction("a", "Fix bug ++urgent");
    const b = makeAction("b", "Refactor ++later");
    const prios: Priority[] = [{ higher: "tu", lower: "tl", createdAt: 0 }];
    const all = [tagUrg, tagLater, a, b];
    // list (default): visible = non-tag open actions
    const visible = [a, b];
    const sp = listPipeline(visible, prios, all);
    // Tag prio: urgent > later → a before b
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
      ],
    });
  });

  it("tag filter with done actions: done tagged actions excluded", () => {
    const tag = makeAction("t", "++proj");
    const a = makeAction("a", "Step 1 ++proj", "done");
    const b = makeAction("b", "Step 2 ++proj", "open", ["a"]);
    const c = makeAction("c", "Step 3 ++proj", "open", ["b"]);
    const all = [tag, a, b, c];
    // list ++proj (without -a): visible = open/active tagged actions
    const visible = [b, c];
    const sp = listPipeline(visible, [], all);
    // a is done → contracted, but b already depends on a directly
    // Result: b→c
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "b" },
        { type: "action", id: "c" },
      ],
    });
  });
});

describe("list pipeline: N-pattern fallback", () => {
  it("N-pattern graph decomposes with all nodes present", () => {
    // Classic N: a→b, c→b, c→d (non-SP)
    const a = makeAction("a", "A");
    const b = makeAction("b", "B", "open", ["a", "c"]);
    const c = makeAction("c", "C");
    const d = makeAction("d", "D", "open", ["c"]);
    const all = [a, b, c, d];
    const sp = listPipeline(all, [], all);
    // Falls back to topological layering; all nodes present
    expect(actionIds(sp).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("contracting a node can eliminate an N-pattern", () => {
    // a→X→c, b→X→c, b→d — X is hidden
    // After contracting X: a→c, b→c, b→d — still N-pattern
    // But if instead: a→X, X→b, X→c with X hidden
    // After contracting X: a→b, a→c — that's SP (fork)
    const a = makeAction("a", "A");
    const x = makeAction("x", "Hidden", "done", ["a"]);
    const b = makeAction("b", "B", "open", ["x"]);
    const c = makeAction("c", "C", "open", ["x"]);
    const all = [a, x, b, c];
    const visible = [a, b, c];
    const sp = listPipeline(visible, [], all);
    // After contracting x: a→b, a→c → seq(a, par(b, c))
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        {
          type: "par",
          children: [
            { type: "action", id: "b" },
            { type: "action", id: "c" },
          ],
        },
      ],
    });
  });

  it("contracting a node can introduce an N-pattern", () => {
    // a→X, b→X, X→c, b→d — X is hidden
    // After contracting X: a→c, b→c, b→d — N-pattern!
    const a = makeAction("a", "A");
    const b = makeAction("b", "B");
    const x = makeAction("x", "Hidden", "done", ["a", "b"]);
    const c = makeAction("c", "C", "open", ["x"]);
    const d = makeAction("d", "D", "open", ["b"]);
    const all = [a, b, x, c, d];
    const visible = [a, b, c, d];
    const sp = listPipeline(visible, [], all);
    // N-pattern → fallback decomposition, all nodes present
    expect(actionIds(sp).sort()).toEqual(["a", "b", "c", "d"]);
    // Verify topological ordering: b and a must come before c
    // (fallback produces seq of layers)
    expect(sp.type).toBe("seq");
  });
});

describe("list pipeline: mixed prereqs and priorities with contraction", () => {
  it("priority through hidden node is preserved", () => {
    // a >prio> X >prio> b, X is hidden
    const a = makeAction("a", "High");
    const x = makeAction("x", "Mid", "done");
    const b = makeAction("b", "Low");
    const prios: Priority[] = [
      { higher: "a", lower: "x", createdAt: 0 },
      { higher: "x", lower: "b", createdAt: 1 },
    ];
    const all = [a, x, b];
    const visible = [a, b];
    const sp = listPipeline(visible, prios, all);
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
      ],
    });
  });

  it("prereq and prio combine: prereq wins over conflicting prio", () => {
    // b requires a (a→b), but prio says b>a — prio is dropped
    const a = makeAction("a", "Prereq");
    const b = makeAction("b", "Dependent", "open", ["a"]);
    const prios: Priority[] = [{ higher: "b", lower: "a", createdAt: 0 }];
    const all = [a, b];
    const sp = listPipeline(all, prios, all);
    // Prereq wins: a before b
    expect(sp).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
      ],
    });
  });
});
