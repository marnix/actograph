// Compute the work order graph from prerequisites and priorities.
//
// Start with prerequisite edges, then add priority edges oldest-first,
// skipping any that would introduce a cycle. This naturally resolves
// conflicts where priority contradicts dependency ordering, and drops
// the most recently added priority edge when a cycle would form.

import Graph from "graphology";
import type { Action, Prerequisite } from "./action.js";
import type { Priority } from "./priority.js";
import { parseTags, isTagTitle, tagName } from "./tags.js";

interface ActionSummary {
  id: string;
  title: string;
  prerequisites: Prerequisite[];
}

/**
 * Expand tag-based inheritance into concrete prerequisite and priority edges.
 *
 * - If a tag action (e.g. "++urgent") has prerequisites, every action whose
 *   title mentions ++urgent inherits those prerequisites.
 * - If tag action A has priority over tag action B, then every action tagged
 *   with A's tag gets priority over every action tagged with B's tag.
 *
 * Returns new virtual prerequisites (keyed by action id) and virtual priorities
 * to be mixed into the work order computation. Does not mutate inputs.
 */
export function expandTagRelations(
  actions: ActionSummary[],
  priorities: Priority[],
): { extraPrereqs: Map<string, Prerequisite[]>; extraPrios: Priority[] } {
  // Build tag→tagAction map
  const tagActionMap = new Map<string, ActionSummary>();
  for (const a of actions) {
    const tn = tagName(a.title);
    if (tn) tagActionMap.set(tn, a);
  }

  // Build tag→member action ids (non-tag actions that mention the tag)
  const tagMembers = new Map<string, string[]>();
  for (const a of actions) {
    if (isTagTitle(a.title)) continue;
    for (const t of parseTags(a.title)) {
      if (!tagMembers.has(t)) tagMembers.set(t, []);
      tagMembers.get(t)!.push(a.id);
    }
  }

  // Inherit prerequisites from tag actions
  const extraPrereqs = new Map<string, Prerequisite[]>();
  for (const [tn, tagAction] of tagActionMap) {
    const members = tagMembers.get(tn);
    if (!members) continue;
    for (const prereq of tagAction.prerequisites) {
      for (const memberId of members) {
        if (memberId === prereq.actionId) continue; // skip self
        if (!extraPrereqs.has(memberId)) extraPrereqs.set(memberId, []);
        extraPrereqs.get(memberId)!.push(prereq);
      }
    }
  }

  // Inherit priorities between tag groups
  const extraPrios: Priority[] = [];
  for (const p of priorities) {
    const higherAction = actions.find((a) => a.id === p.higher);
    const lowerAction = actions.find((a) => a.id === p.lower);
    if (!higherAction || !lowerAction) continue;
    const higherTag = tagName(higherAction.title);
    const lowerTag = tagName(lowerAction.title);
    if (!higherTag || !lowerTag) continue;
    // Both ends are tag actions — expand to member×member priorities
    const higherMembers = tagMembers.get(higherTag) ?? [];
    const lowerMembers = tagMembers.get(lowerTag) ?? [];
    for (const h of higherMembers) {
      for (const l of lowerMembers) {
        if (h !== l) {
          extraPrios.push({ higher: h, lower: l, createdAt: p.createdAt });
        }
      }
    }
  }

  return { extraPrereqs, extraPrios };
}

export function wouldCreateCycle(
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
  allActions?: ActionSummary[],
): Graph {
  const source = allActions ?? actions;
  const sourceIds = new Set(source.map((a) => a.id));

  // Expand tag inheritance into virtual edges
  const { extraPrereqs, extraPrios } = expandTagRelations(source, priorities);

  const full = new Graph({ type: "directed", allowSelfLoops: false });
  for (const id of sourceIds) full.addNode(id);

  // Add prerequisite edges: required action → dependent action
  for (const action of source) {
    const allPrereqs = [
      ...action.prerequisites,
      ...(extraPrereqs.get(action.id) ?? []),
    ];
    for (const prereq of allPrereqs) {
      if (
        sourceIds.has(prereq.actionId) &&
        !full.hasEdge(prereq.actionId, action.id)
      ) {
        full.addEdge(prereq.actionId, action.id);
      }
    }
  }

  // Add priority edges oldest-first, skipping any that would create a cycle
  const allPrios = [...priorities, ...extraPrios];
  const sorted = allPrios
    .filter((p) => sourceIds.has(p.higher) && sourceIds.has(p.lower))
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const p of sorted) {
    if (
      !full.hasEdge(p.higher, p.lower) &&
      !wouldCreateCycle(full, p.higher, p.lower)
    ) {
      full.addEdge(p.higher, p.lower);
    }
  }

  if (!allActions) return full;

  // Contract hidden nodes: for each hidden node, connect its
  // in-neighbors directly to its out-neighbors, then drop it.
  const visibleIds = new Set(actions.map((a) => a.id));
  for (const id of sourceIds) {
    if (visibleIds.has(id)) continue;
    for (const src of full.inNeighbors(id)) {
      for (const tgt of full.outNeighbors(id)) {
        if (src !== tgt && !full.hasEdge(src, tgt)) {
          full.addEdge(src, tgt);
        }
      }
    }
    full.dropNode(id);
  }

  return full;
}

export function addPrerequisite(
  actions: Action[],
  priorities: Priority[],
  fromId: string,
  toId: string,
): void {
  const target = actions.find((a) => a.id === toId);
  if (!target) throw new Error(`Action not found: ${toId}`);
  if (target.prerequisites.some((p) => p.actionId === fromId)) return;
  const graph = computeWorkOrder(actions, priorities);
  if (wouldCreateCycle(graph, fromId, toId)) {
    throw new Error(
      `Cannot add prerequisite: ${fromId} → ${toId} would create a cycle`,
    );
  }
  target.prerequisites.push({ actionId: fromId, createdAt: Date.now() });
}

export function addPriority(
  actions: Action[],
  priorities: Priority[],
  higherId: string,
  lowerId: string,
): void {
  if (priorities.some((p) => p.higher === higherId && p.lower === lowerId))
    return;
  const graph = computeWorkOrder(actions, priorities);
  if (wouldCreateCycle(graph, higherId, lowerId)) {
    throw new Error(
      `Cannot add priority: ${higherId} → ${lowerId} would create a cycle`,
    );
  }
  priorities.push({ higher: higherId, lower: lowerId, createdAt: Date.now() });
}

export function removePrerequisite(
  actions: Action[],
  fromId: string,
  toId: string,
): void {
  const target = actions.find((a) => a.id === toId);
  if (!target) throw new Error(`Action not found: ${toId}`);
  const idx = target.prerequisites.findIndex((p) => p.actionId === fromId);
  if (idx === -1) throw new Error(`No prerequisite ${fromId} on ${toId}`);
  target.prerequisites.splice(idx, 1);
}

export function removePriority(
  priorities: Priority[],
  higherId: string,
  lowerId: string,
): void {
  const idx = priorities.findIndex(
    (p) => p.higher === higherId && p.lower === lowerId,
  );
  if (idx === -1) throw new Error(`No priority ${higherId} over ${lowerId}`);
  priorities.splice(idx, 1);
}
