// Sort parallel children in an SP tree by action state priority.
// Active actions first, then open, then done, then skipped.
// Within each state group, original order is preserved (stable sort).

import type { SPNode } from "./sp-decompose.js";
import type { ActionState } from "./action.js";

const STATE_ORDER: Record<ActionState, number> = {
  active: 0,
  open: 1,
  done: 2,
  skipped: 3,
};

/**
 * Return the minimum state rank found in an SP subtree.
 * Used to sort compound par children (seq nodes, nested par nodes)
 * by their "best" action.
 */
function minStateRank(
  node: SPNode,
  stateOf: (id: string) => ActionState,
): number {
  if (node.type === "action") return STATE_ORDER[stateOf(node.id)] ?? 99;
  return Math.min(...node.children.map((c) => minStateRank(c, stateOf)));
}

/** Sort parallel children in-place, recursively, throughout the SP tree. */
export function sortSP(
  node: SPNode,
  stateOf: (id: string) => ActionState,
): SPNode {
  if (node.type === "action") return node;
  const children = node.children.map((c) => sortSP(c, stateOf));
  if (node.type === "par") {
    children.sort(
      (a, b) => minStateRank(a, stateOf) - minStateRank(b, stateOf),
    );
  }
  return { type: node.type, children };
}
