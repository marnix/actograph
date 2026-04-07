// Compute the work order graph from prerequisites and priorities.
//
// Start with prerequisite edges, then add priority edges oldest-first,
// skipping any that would introduce a cycle. This naturally resolves
// conflicts where priority contradicts dependency ordering, and drops
// the most recently added priority edge when a cycle would form.

import Graph from "graphology";
import type { Prerequisite } from "./action.js";
import type { Priority } from "./priority.js";

interface ActionSummary {
  id: string;
  prerequisites: Prerequisite[];
}

function wouldCreateCycle(
  graph: Graph,
  source: string,
  target: string,
): boolean {
  // Adding source→target creates a cycle iff target can already reach source
  const visited = new Set<string>();
  const stack = [target];
  while (stack.length > 0) {
    const node = stack.pop() as string;
    if (node === source) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const neighbor of graph.outNeighbors(node)) {
      if (!visited.has(neighbor)) stack.push(neighbor);
    }
  }
  return false;
}

export function computeWorkOrder(
  actions: ActionSummary[],
  priorities: Priority[],
): Graph {
  const ids = new Set(actions.map((a) => a.id));

  const graph = new Graph({ type: "directed", allowSelfLoops: false });
  for (const id of ids) graph.addNode(id);

  // Add prerequisite edges: required action → dependent action
  for (const action of actions) {
    for (const prereq of action.prerequisites) {
      if (
        ids.has(prereq.actionId) &&
        !graph.hasEdge(prereq.actionId, action.id)
      ) {
        graph.addEdge(prereq.actionId, action.id);
      }
    }
  }

  // Add priority edges oldest-first, skipping any that would create a cycle
  const sorted = [...priorities]
    .filter((p) => ids.has(p.higher) && ids.has(p.lower))
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const p of sorted) {
    if (
      !graph.hasEdge(p.higher, p.lower) &&
      !wouldCreateCycle(graph, p.higher, p.lower)
    ) {
      graph.addEdge(p.higher, p.lower);
    }
  }

  return graph;
}
