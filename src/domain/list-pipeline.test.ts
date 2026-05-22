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

/** Run the list pipeline and assert the SP-tree matches the work-order graph. */
function assertPipeline(
  visible: Action[],
  priorities: Priority[],
  allActions: Action[],
): SPNode {
  const graph = computeWorkOrder(visible, priorities, allActions);
  const sp = spDecompose(graph);
  assertSPMatchesGraph(sp, graph);
  return sp;
}

/** Collect action ids from an SP tree in pre-order. */
function actionIds(node: SPNode): string[] {
  if (node.type === "action") return [node.id];
  return node.children.flatMap(actionIds);
}

/** Get the "source" action ids of an SP subtree (first reachable actions). */
function spSources(node: SPNode): string[] {
  if (node.type === "action") return [node.id];
  if (node.type === "par") return node.children.flatMap(spSources);
  // seq: sources are the sources of the first child
  return spSources(node.children[0]!);
}

/** Get the "sink" action ids of an SP subtree (last reachable actions). */
function spSinks(node: SPNode): string[] {
  if (node.type === "action") return [node.id];
  if (node.type === "par") return node.children.flatMap(spSinks);
  // seq: sinks are the sinks of the last child
  return spSinks(node.children[node.children.length - 1]!);
}

/**
 * Convert an SP-tree back to its implied edges (transitive reduction).
 * For each seq node, connect sinks of child[i] to sources of child[i+1].
 * Returns sorted "a->b" strings for easy comparison.
 */
function spEdges(node: SPNode): string[] {
  const edges = new Set<string>();
  function collect(n: SPNode): void {
    if (n.type === "action") return;
    for (const child of n.children) collect(child);
    if (n.type === "seq") {
      for (let i = 0; i < n.children.length - 1; i++) {
        for (const src of spSinks(n.children[i]!)) {
          for (const tgt of spSources(n.children[i + 1]!)) {
            edges.add(`${src}->${tgt}`);
          }
        }
      }
    }
  }
  collect(node);
  return [...edges].sort();
}

/** Extract sorted edge strings from a graphology Graph. */
function graphEdges(graph: ReturnType<typeof computeWorkOrder>): string[] {
  return graph
    .mapEdges((_e, _a, source, target) => `${source}->${target}`)
    .sort();
}

/**
 * Assert that an SP-tree is a valid decomposition of the given graph:
 * same nodes, and the SP-tree's implied edges match the graph's edges exactly.
 */
function assertSPMatchesGraph(
  sp: SPNode,
  graph: ReturnType<typeof computeWorkOrder>,
): void {
  expect(actionIds(sp).sort()).toEqual(graph.nodes().sort());
  expect(spEdges(sp)).toEqual(graphEdges(graph));
}

// --- Tests ---

describe("list pipeline: basic (no hidden nodes)", () => {
  it("single open action → single action node", () => {
    const a = makeAction("a", "Do thing");
    assertPipeline([a], [], [a]);
  });

  it("two unrelated actions → parallel", () => {
    const a = makeAction("a", "Alpha");
    const b = makeAction("b", "Beta");
    assertPipeline([a, b], [], [a, b]);
  });

  it("chain via prereqs: a→b→c", () => {
    const a = makeAction("a", "First");
    const b = makeAction("b", "Second", "open", ["a"]);
    const c = makeAction("c", "Third", "open", ["b"]);
    const all = [a, b, c];
    assertPipeline(all, [], all);
  });

  it("chain via priorities: a>b>c", () => {
    const a = makeAction("a", "High");
    const b = makeAction("b", "Med");
    const c = makeAction("c", "Low");
    const prios: Priority[] = [
      { higher: "a", lower: "b", createdAt: 0 },
      { higher: "b", lower: "c", createdAt: 1 },
    ];
    const all = [a, b, c];
    assertPipeline(all, prios, all);
  });

  it("diamond: a→b, a→c, b→d, c→d", () => {
    const a = makeAction("a", "Start");
    const b = makeAction("b", "Left", "open", ["a"]);
    const c = makeAction("c", "Right", "open", ["a"]);
    const d = makeAction("d", "End", "open", ["b", "c"]);
    const all = [a, b, c, d];
    assertPipeline(all, [], all);
  });
});

describe("list pipeline: contraction of done/skipped actions", () => {
  it("done action in middle of chain: a→B(done)→c contracts to a→c", () => {
    const a = makeAction("a", "First");
    const b = makeAction("b", "Middle", "done", ["a"]);
    const c = makeAction("c", "Last", "open", ["b"]);
    const all = [a, b, c];
    const visible = [a, c];
    assertPipeline(visible, [], all);
  });

  it("skipped action contracted preserves ordering", () => {
    const a = makeAction("a", "First");
    const b = makeAction("b", "Skipped", "skipped", ["a"]);
    const c = makeAction("c", "Last", "open", ["b"]);
    const all = [a, b, c];
    const visible = [a, c];
    assertPipeline(visible, [], all);
  });

  it("multiple done actions in chain: a→B→C→d contracts to a→d", () => {
    const a = makeAction("a", "Start");
    const b = makeAction("b", "Done1", "done", ["a"]);
    const c = makeAction("c", "Done2", "done", ["b"]);
    const d = makeAction("d", "End", "open", ["c"]);
    const all = [a, b, c, d];
    const visible = [a, d];
    assertPipeline(visible, [], all);
  });

  it("done action with fan-out: a→B(done), B→c, B→d contracts to a→c, a→d", () => {
    const a = makeAction("a", "Root");
    const b = makeAction("b", "Hub", "done", ["a"]);
    const c = makeAction("c", "Left", "open", ["b"]);
    const d = makeAction("d", "Right", "open", ["b"]);
    const all = [a, b, c, d];
    const visible = [a, c, d];
    assertPipeline(visible, [], all);
  });

  it("done action with fan-in: a→C(done), b→C(done), C→d contracts to a→d, b→d", () => {
    const a = makeAction("a", "Left");
    const b = makeAction("b", "Right");
    const c = makeAction("c", "Join", "done", ["a", "b"]);
    const d = makeAction("d", "End", "open", ["c"]);
    const all = [a, b, c, d];
    const visible = [a, b, d];
    assertPipeline(visible, [], all);
  });
});

describe("list pipeline: tag filtering (list ++tag)", () => {
  it("filters to only tagged actions, contracts untagged", () => {
    const tag = makeAction("t", "++proj");
    const a = makeAction("a", "Setup ++proj");
    const b = makeAction("b", "Unrelated work");
    const c = makeAction("c", "Deploy ++proj", "open", ["a", "b"]);
    const all = [tag, a, b, c];
    const visible = [a, c];
    assertPipeline(visible, [], all);
  });

  it("tag action itself is always hidden (contracted)", () => {
    const tag = makeAction("t", "++urgent");
    const a = makeAction("a", "Fix bug ++urgent");
    const b = makeAction("b", "Write test ++urgent");
    const all = [tag, a, b];
    const visible = [a, b];
    assertPipeline(visible, [], all);
  });

  it("tag inheritance: tag prereq creates ordering among tagged actions", () => {
    // Tag ++proj requires action "setup" to be done first
    const setup = makeAction("setup", "Setup infra");
    const tag = makeAction("t", "++proj", "open", ["setup"]);
    const a = makeAction("a", "Build ++proj");
    const b = makeAction("b", "Deploy ++proj");
    const all = [setup, tag, a, b];
    // Tag inheritance: a and b both inherit prereq on "setup"
    // But setup is not in visible → contracted
    // After contraction: no edges between a and b
    const visible = [a, b];
    assertPipeline(visible, [], all);
  });

  it("tag priority inheritance creates ordering between tagged actions", () => {
    const tagUrg = makeAction("tu", "++urgent");
    const tagLater = makeAction("tl", "++later");
    const a = makeAction("a", "Fix bug ++urgent");
    const b = makeAction("b", "Refactor ++later");
    const prios: Priority[] = [{ higher: "tu", lower: "tl", createdAt: 0 }];
    const all = [tagUrg, tagLater, a, b];
    const visible = [a, b];
    assertPipeline(visible, prios, all);
  });

  it("tag filter with done actions: done tagged actions excluded", () => {
    const tag = makeAction("t", "++proj");
    const a = makeAction("a", "Step 1 ++proj", "done");
    const b = makeAction("b", "Step 2 ++proj", "open", ["a"]);
    const c = makeAction("c", "Step 3 ++proj", "open", ["b"]);
    const all = [tag, a, b, c];
    const visible = [b, c];
    assertPipeline(visible, [], all);
  });
});

describe("list pipeline: N-pattern resolution", () => {
  it("N-pattern is resolved by adding edge, SP matches graph", () => {
    // N-shape: e→a, a→c, b→c, b→d (non-SP without resolution)
    // resolveNShapes adds a→d.
    // Resolved graph: e→a, a→c, a→d, b→c, b→d
    // Correct SP: ((e>>a)||b)>>(c||d)
    const e = makeAction("e", "E");
    const a = makeAction("a", "A", "open", ["e"]);
    const b = makeAction("b", "B");
    const c = makeAction("c", "C", "open", ["a", "b"]);
    const d = makeAction("d", "D", "open", ["b"]);
    const all = [e, a, b, c, d];
    assertPipeline(all, [], all);
  });

  it("classic N-shape: a→b, c→b, c→d", () => {
    const a = makeAction("a", "A");
    const b = makeAction("b", "B", "open", ["a", "c"]);
    const c = makeAction("c", "C");
    const d = makeAction("d", "D", "open", ["c"]);
    const all = [a, b, c, d];
    assertPipeline(all, [], all);
  });

  it("contracting a node can eliminate an N-pattern", () => {
    // a→X, X→b, X→c with X hidden
    // After contracting X: a→b, a→c — SP (fork)
    const a = makeAction("a", "A");
    const x = makeAction("x", "Hidden", "done", ["a"]);
    const b = makeAction("b", "B", "open", ["x"]);
    const c = makeAction("c", "C", "open", ["x"]);
    const all = [a, x, b, c];
    const visible = [a, b, c];
    assertPipeline(visible, [], all);
  });

  it("contracting a node can introduce an N-pattern", () => {
    // a→X, b→X, X→c, b→d — X is hidden
    // After contracting X: a→c, b→c, b→d — N-pattern!
    // resolveNShapes adds a→d
    const a = makeAction("a", "A");
    const b = makeAction("b", "B");
    const x = makeAction("x", "Hidden", "done", ["a", "b"]);
    const c = makeAction("c", "C", "open", ["x"]);
    const d = makeAction("d", "D", "open", ["b"]);
    const all = [a, b, x, c, d];
    const visible = [a, b, c, d];
    assertPipeline(visible, [], all);
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
    assertPipeline(visible, prios, all);
  });

  it("prereq and prio combine: prereq wins over conflicting prio", () => {
    // b requires a (a→b), but prio says b>a — prio is dropped
    const a = makeAction("a", "Prereq");
    const b = makeAction("b", "Dependent", "open", ["a"]);
    const prios: Priority[] = [{ higher: "b", lower: "a", createdAt: 0 }];
    const all = [a, b];
    assertPipeline(all, prios, all);
  });
});

describe("list pipeline: real-world graph (anonymized from bugdb)", () => {
  // 26 visible open/active actions, 44 total (including tags and done prereqs).
  // No priorities. Graph has 19 edges after contraction.
  function mk(
    uuid: string,
    title: string,
    state: Action["state"],
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

  const all = [
    mk("1", "Action 1", "open"),
    mk("2", "Action 2", "open"),
    mk("3", "Action 3", "open"),
    mk("4", "Action 4", "active", ["42"]),
    mk("5", "Action 5", "open", ["6", "19", "24", "13", "26", "2"]),
    mk("6", "Action 6", "open"),
    mk("7", "Action 7", "active"),
    mk("27", "Action 27", "done"),
    mk("8", "Action 8", "active"),
    mk("9", "Action 9", "active", ["34"]),
    mk("28", "++huis", "open"),
    mk("10", "Action 10", "open"),
    mk("29", "++gamma", "open"),
    mk("30", "++paenmavanrijn", "open"),
    mk("31", "++buren", "open"),
    mk("32", "Action 32", "done", ["37"]),
    mk("33", "++cp", "open"),
    mk("34", "Action 34", "done", ["37"]),
    mk("35", "Action 35", "done"),
    mk("11", "Action 11", "open"),
    mk("36", "Action 36", "done"),
    mk("12", "Action 12", "open", ["15"]),
    mk("13", "Action 13", "open"),
    mk("14", "Action 14", "active", ["32"]),
    mk("15", "Action 15", "active"),
    mk("37", "Action 37", "done"),
    mk("16", "Action 16", "open", ["37", "14"]),
    mk("38", "++schoonouders", "open"),
    mk("17", "Action 17", "active"),
    mk("18", "Action 18", "open", ["27"]),
    mk("39", "++auto", "open"),
    mk("19", "Action 19", "open", ["6"]),
    mk("40", "++rika", "open"),
    mk("20", "Action 20", "open"),
    mk("21", "Action 21", "open", ["2"]),
    mk("22", "Action 22", "open", ["36", "43", "12"]),
    mk("23", "Action 23", "open"),
    mk("41", "++zelf", "open"),
    mk("24", "Action 24", "open", ["19"]),
    mk("25", "Action 25", "open", ["22"]),
    mk("26", "Action 26", "open"),
    mk("42", "Action 42", "done"),
    mk("43", "Action 43", "skipped"),
    mk("44", "++geld", "open"),
  ];

  const visibleIds = new Set([
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
  ]);
  const visible = all.filter((a) => visibleIds.has(a.uuid));

  it("SP-tree matches work-order graph", () => {
    assertPipeline(visible, [], all);
  });

  it("produces expected SP structure", () => {
    const graph = computeWorkOrder(visible, [], all);
    const sp = spDecompose(graph);
    // par of 15 children: 12 independent actions + 3 sequential chains
    //   chain 1: 14 >> 16
    //   chain 2: 15 >> 12 >> 22 >> 25
    //   chain 3: par(2,6,13,26) >> 19 >> 24 >> par(5,21)
    expect(sp.type).toBe("par");
    expect(actionIds(sp).sort()).toEqual([...visibleIds].sort());
    const seqs = (sp as { children: SPNode[] }).children.filter(
      (c) => c.type === "seq",
    );
    expect(seqs).toHaveLength(3);
    // Verify the three chains by their action content
    const seqIds = seqs.map((s) => actionIds(s));
    expect(seqIds).toContainEqual(["14", "16"]);
    expect(seqIds).toContainEqual(["15", "12", "22", "25"]);
    expect(seqIds).toContainEqual(
      expect.arrayContaining(["2", "6", "13", "26", "19", "24", "5", "21"]),
    );
  });
});
