import { describe, it, expect } from "vitest";
import type { SPNode } from "./sp-decompose.js";
import type { ActionState } from "./action.js";
import { sortSP } from "./sort-sp.js";

function stateOf(
  states: Record<string, ActionState>,
): (id: string) => ActionState {
  return (id) => states[id] ?? "open";
}

describe("sortSP", () => {
  it("sorts parallel children by state: active before open", () => {
    const tree: SPNode = {
      type: "par",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
      ],
    };
    const result = sortSP(tree, stateOf({ a: "open", b: "active" }));
    expect(result).toEqual({
      type: "par",
      children: [
        { type: "action", id: "b" },
        { type: "action", id: "a" },
      ],
    });
  });

  it("sorts all four states in order", () => {
    const tree: SPNode = {
      type: "par",
      children: [
        { type: "action", id: "d" },
        { type: "action", id: "c" },
        { type: "action", id: "b" },
        { type: "action", id: "a" },
      ],
    };
    const result = sortSP(
      tree,
      stateOf({ a: "active", b: "open", c: "done", d: "skipped" }),
    );
    expect(
      (result as { children: SPNode[] }).children.map(
        (c) => (c as { id: string }).id,
      ),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("preserves order within same state (stable sort)", () => {
    const tree: SPNode = {
      type: "par",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
        { type: "action", id: "c" },
      ],
    };
    const result = sortSP(tree, stateOf({ a: "open", b: "open", c: "open" }));
    expect(
      (result as { children: SPNode[] }).children.map(
        (c) => (c as { id: string }).id,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("does not reorder sequential children", () => {
    const tree: SPNode = {
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
      ],
    };
    const result = sortSP(tree, stateOf({ a: "open", b: "active" }));
    expect(result).toEqual(tree);
  });

  it("sorts nested par inside seq", () => {
    const tree: SPNode = {
      type: "seq",
      children: [
        {
          type: "par",
          children: [
            { type: "action", id: "a" },
            { type: "action", id: "b" },
          ],
        },
        { type: "action", id: "c" },
      ],
    };
    const result = sortSP(tree, stateOf({ a: "done", b: "active" }));
    const par = (result as { children: SPNode[] }).children[0] as {
      children: SPNode[];
    };
    expect(par.children.map((c) => (c as { id: string }).id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("sorts compound par children by best action state", () => {
    const tree: SPNode = {
      type: "par",
      children: [
        {
          type: "seq",
          children: [
            { type: "action", id: "a" },
            { type: "action", id: "b" },
          ],
        },
        { type: "action", id: "c" },
      ],
    };
    const result = sortSP(tree, stateOf({ a: "done", b: "done", c: "active" }));
    const ids = (result as { children: SPNode[] }).children.map((c) =>
      c.type === "action" ? c.id : "seq",
    );
    expect(ids).toEqual(["c", "seq"]);
  });

  it("returns action nodes unchanged", () => {
    const node: SPNode = { type: "action", id: "x" };
    expect(sortSP(node, stateOf({}))).toEqual(node);
  });
});
