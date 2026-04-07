import { describe, it, expect } from "vitest";
import Graph from "graphology";
import { spDecompose, type SPNode } from "./sp-decompose.js";

function dag(edges: [string, string][]): Graph {
  const g = new Graph({ type: "directed", allowSelfLoops: false });
  const nodes = new Set(edges.flatMap(([a, b]) => [a, b]));
  for (const n of nodes) g.addNode(n);
  for (const [a, b] of edges) g.addEdge(a, b);
  return g;
}

function singleNode(id: string): Graph {
  const g = new Graph({ type: "directed", allowSelfLoops: false });
  g.addNode(id);
  return g;
}

// Assert every seq/par has >= 2 children (recursive)
function assertMinChildren(node: SPNode): void {
  if (node.type === "action") return;
  expect(
    node.children.length,
    `${node.type} must have >= 2 children`,
  ).toBeGreaterThanOrEqual(2);
  for (const child of node.children) assertMinChildren(child);
}

// Collect all action ids from an SP tree
function actionIds(node: SPNode): string[] {
  if (node.type === "action") return [node.id];
  return node.children.flatMap(actionIds);
}

describe("spDecompose", () => {
  it("single action", () => {
    const result = spDecompose(singleNode("a"));
    expect(result).toEqual({ type: "action", id: "a" });
  });

  it("two sequential actions: a->b", () => {
    const result = spDecompose(dag([["a", "b"]]));
    assertMinChildren(result);
    expect(result).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
      ],
    });
  });

  it("two parallel actions (no edges)", () => {
    const g = new Graph({ type: "directed", allowSelfLoops: false });
    g.addNode("a");
    g.addNode("b");
    const result = spDecompose(g);
    assertMinChildren(result);
    expect(result.type).toBe("par");
    expect(actionIds(result).sort()).toEqual(["a", "b"]);
  });

  it("chain: a->b->c", () => {
    const result = spDecompose(
      dag([
        ["a", "b"],
        ["b", "c"],
      ]),
    );
    assertMinChildren(result);
    expect(result).toEqual({
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
        { type: "action", id: "c" },
      ],
    });
  });

  it("parallel chains: a->b and c->d", () => {
    const result = spDecompose(
      dag([
        ["a", "b"],
        ["c", "d"],
      ]),
    );
    assertMinChildren(result);
    expect(result.type).toBe("par");
    const children = (result as { type: "par"; children: SPNode[] }).children;
    expect(children).toHaveLength(2);
    // Each child should be a seq of 2
    for (const child of children) {
      expect(child.type).toBe("seq");
      assertMinChildren(child);
    }
    expect(actionIds(result).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("fork: a->b, a->c", () => {
    const result = spDecompose(
      dag([
        ["a", "b"],
        ["a", "c"],
      ]),
    );
    assertMinChildren(result);
    // seq(a, par(b, c))
    expect(result.type).toBe("seq");
    expect(actionIds(result).sort()).toEqual(["a", "b", "c"]);
  });

  it("join: a->c, b->c", () => {
    const result = spDecompose(
      dag([
        ["a", "c"],
        ["b", "c"],
      ]),
    );
    assertMinChildren(result);
    // seq(par(a, b), c)
    expect(result.type).toBe("seq");
    expect(actionIds(result).sort()).toEqual(["a", "b", "c"]);
  });

  it("diamond: a->b, a->c, b->d, c->d", () => {
    const result = spDecompose(
      dag([
        ["a", "b"],
        ["a", "c"],
        ["b", "d"],
        ["c", "d"],
      ]),
    );
    assertMinChildren(result);
    // seq(a, par(b, c), d)
    expect(result).toEqual({
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

  it("N-shape (non-SP) falls back gracefully", () => {
    // a->b, c->b, c->d — the classic non-SP fence
    const result = spDecompose(
      dag([
        ["a", "b"],
        ["c", "b"],
        ["c", "d"],
      ]),
    );
    assertMinChildren(result);
    // Should contain all 4 actions
    expect(actionIds(result).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("triangle off fork: a->b, b->c, b->d, c->d", () => {
    const result = spDecompose(
      dag([
        ["a", "b"],
        ["b", "c"],
        ["b", "d"],
        ["c", "d"],
      ]),
    );
    assertMinChildren(result);
    expect(actionIds(result).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("all results have >= 2 children in seq/par nodes", () => {
    // A more complex graph
    const result = spDecompose(
      dag([
        ["a", "b"],
        ["a", "c"],
        ["b", "d"],
        ["c", "d"],
        ["d", "e"],
        ["d", "f"],
        ["e", "g"],
        ["f", "g"],
      ]),
    );
    assertMinChildren(result);
    expect(actionIds(result).sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
    ]);
  });
});
