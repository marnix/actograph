import { describe, it, expect } from "vitest";
import type { Action } from "./action.js";
import type { Priority } from "./priority.js";
import {
  computeWorkOrder,
  expandTagRelations,
  addPriority,
} from "./work-order.js";
import { spDecompose } from "./sp-decompose.js";
import { renderSP } from "./render-sp.js";
import { isTagTitle } from "./tags.js";

function makeAction(id: string, title: string, ...prereqIds: string[]): Action {
  return {
    id,
    title,
    state: "open",
    prerequisites: prereqIds.map((actionId) => ({ actionId, createdAt: 0 })),
  };
}

describe("prio between tag actions", () => {
  it("addPriority succeeds between two tag actions", () => {
    const actions: Action[] = [
      makeAction("t1", "++urgent"),
      makeAction("t2", "++nicetohave"),
    ];
    const priorities: Priority[] = [];
    // This is the operation that was failing in the CLI
    addPriority(actions, priorities, "t1", "t2");
    expect(priorities).toHaveLength(1);
    expect(priorities[0]).toEqual(
      expect.objectContaining({ higher: "t1", lower: "t2" }),
    );
  });

  it("tag prio expands to member actions in work order", () => {
    const actions: Action[] = [
      makeAction("t1", "++urgent"),
      makeAction("t2", "++nicetohave"),
      makeAction("a1", "Fix bug ++urgent"),
      makeAction("a2", "Polish UI ++nicetohave"),
    ];
    const priorities: Priority[] = [
      { higher: "t1", lower: "t2", createdAt: 0 },
    ];
    // Filter out tag actions (as list command does)
    const visible = actions.filter((a) => !isTagTitle(a.title));
    const graph = computeWorkOrder(visible, priorities, actions);
    // a1 (urgent) should come before a2 (nicetohave)
    expect(graph.hasEdge("a1", "a2")).toBe(true);
  });
});

describe("tag prio in ASCII output", () => {
  it("shows sequential ordering from tag prio", () => {
    const actions: Action[] = [
      makeAction("t1", "++urgent"),
      makeAction("t2", "++nicetohave"),
      makeAction("a1", "Fix bug ++urgent"),
      makeAction("a2", "Polish UI ++nicetohave"),
    ];
    const priorities: Priority[] = [
      { higher: "t1", lower: "t2", createdAt: 0 },
    ];
    const visible = actions.filter((a) => !isTagTitle(a.title));
    const graph = computeWorkOrder(visible, priorities, actions);
    const sp = spDecompose(graph);

    // Build annotation map like the list command does
    const actionMap = new Map(visible.map((a) => [a.id, a]));
    const { extraPrios } = expandTagRelations(actions, priorities);
    const prioPreds = new Map<string, Set<string>>();
    for (const p of [...priorities, ...extraPrios]) {
      if (actionMap.has(p.higher) && actionMap.has(p.lower)) {
        if (!prioPreds.has(p.lower)) prioPreds.set(p.lower, new Set());
        prioPreds.get(p.lower)!.add(p.higher);
      }
    }

    const output = renderSP(sp, (id) => {
      const a = actionMap.get(id);
      if (!a) return id;
      const prios = prioPreds.get(id);
      const parts: string[] = [];
      if (prios) parts.push(...Array.from(prios).map((p) => `prio:${p}`));
      const suffix = parts.length > 0 ? `  ← ${parts.join(", ")}` : "";
      return `[ ] ${a.title}  (${a.id})${suffix}`;
    });

    // Should be sequential (>>) not parallel (||)
    expect(output).toContain(">>");
    // a1 should appear before a2
    const a1Pos = output.indexOf("a1");
    const a2Pos = output.indexOf("a2");
    expect(a1Pos).toBeLessThan(a2Pos);
    // a2 should have a prio annotation pointing to a1
    expect(output).toContain("prio:a1");
  });

  it("multiple members per tag all get sequential ordering", () => {
    const actions: Action[] = [
      makeAction("t1", "++urgent"),
      makeAction("t2", "++later"),
      makeAction("a1", "Fix bug ++urgent"),
      makeAction("a2", "Fix crash ++urgent"),
      makeAction("a3", "Refactor ++later"),
    ];
    const priorities: Priority[] = [
      { higher: "t1", lower: "t2", createdAt: 0 },
    ];
    const visible = actions.filter((a) => !isTagTitle(a.title));
    const graph = computeWorkOrder(visible, priorities, actions);
    // Both urgent actions should come before the later action
    expect(graph.hasEdge("a1", "a3")).toBe(true);
    expect(graph.hasEdge("a2", "a3")).toBe(true);
  });

  it("without tag prio, tagged actions are parallel", () => {
    const actions: Action[] = [
      makeAction("t1", "++urgent"),
      makeAction("t2", "++nicetohave"),
      makeAction("a1", "Fix bug ++urgent"),
      makeAction("a2", "Polish UI ++nicetohave"),
    ];
    // No priorities at all
    const visible = actions.filter((a) => !isTagTitle(a.title));
    const graph = computeWorkOrder(visible, [], actions);
    expect(graph.hasEdge("a1", "a2")).toBe(false);
    expect(graph.hasEdge("a2", "a1")).toBe(false);
  });
});
