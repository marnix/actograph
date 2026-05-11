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
  uuid: string;
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
 * Returns new virtual prerequisites (keyed by action uuid) and virtual priorities
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

  // Build tag→member action uuids (non-tag actions that mention the tag)
  const tagMembers = new Map<string, string[]>();
  for (const a of actions) {
    if (isTagTitle(a.title)) continue;
    for (const t of parseTags(a.title)) {
      if (!tagMembers.has(t)) tagMembers.set(t, []);
      tagMembers.get(t)!.push(a.uuid);
    }
  }

  // Inherit prerequisites from tag actions
  const extraPrereqs = new Map<string, Prerequisite[]>();
  for (const [tn, tagAction] of tagActionMap) {
    const members = tagMembers.get(tn);
    if (!members) continue;
    for (const prereq of tagAction.prerequisites) {
      for (const memberUuid of members) {
        if (memberUuid === prereq.uuid) continue; // skip self
        if (!extraPrereqs.has(memberUuid)) extraPrereqs.set(memberUuid, []);
        extraPrereqs.get(memberUuid)!.push(prereq);
      }
    }
  }

  // Inherit priorities between tag groups
  const extraPrios: Priority[] = [];
  for (const p of priorities) {
    const higherAction = actions.find((a) => a.uuid === p.higher);
    const lowerAction = actions.find((a) => a.uuid === p.lower);
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
  const sourceUuids = new Set(source.map((a) => a.uuid));

  // Expand tag inheritance into virtual edges
  const { extraPrereqs, extraPrios } = expandTagRelations(source, priorities);

  const full = new Graph({ type: "directed", allowSelfLoops: false });
  for (const uuid of sourceUuids) full.addNode(uuid);

  // Collect all direct prerequisite pairs (as a set for O(1) lookup)
  const directPrereqs = new Set<string>();
  for (const action of source) {
    const allPrereqs = [
      ...action.prerequisites,
      ...(extraPrereqs.get(action.uuid) ?? []),
    ];
    for (const prereq of allPrereqs) {
      if (sourceUuids.has(prereq.uuid)) {
        directPrereqs.add(`${prereq.uuid}\0${action.uuid}`);
      }
    }
  }

  // Build work order edges with explicit semantics:
  //   A before B iff:
  //     - A is a direct prereq of B, OR
  //     - A directly takes prio over B AND B is NOT a direct prereq of A
  //
  // Prereq edges are unconditional; prio edges are added oldest-first,
  // skipping any that would create a cycle.

  // Add prerequisite edges
  for (const key of directPrereqs) {
    const [from, to] = key.split("\0") as [string, string];
    if (!full.hasEdge(from, to)) {
      full.addEdge(from, to);
    }
  }

  // Add priority edges oldest-first, skipping cycles
  const allPrios = [...priorities, ...extraPrios];
  const sorted = allPrios
    .filter((p) => sourceUuids.has(p.higher) && sourceUuids.has(p.lower))
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const p of sorted) {
    // Skip if B is a direct prereq of A (prio would contradict dependency)
    if (directPrereqs.has(`${p.lower}\0${p.higher}`)) continue;
    if (
      !full.hasEdge(p.higher, p.lower) &&
      !wouldCreateCycle(full, p.higher, p.lower)
    ) {
      full.addEdge(p.higher, p.lower);
    }
  }

  // Resolve N-shapes to make the graph series-parallel.
  // An N-shape is R←P→S←Q where Q has no edge to R.
  // Adding Q→R makes it (P||Q) >> (R||S).
  // Only resolve on the final visible graph — resolving on the full
  // graph before contraction can create spurious ordering between
  // visible actions through hidden intermediaries.
  if (!allActions) {
    resolveNShapes(full);
    return full;
  }

  // Contract hidden nodes: for each hidden node, connect its
  // in-neighbors directly to its out-neighbors, then drop it.
  const visibleUuids = new Set(actions.map((a) => a.uuid));
  for (const uuid of sourceUuids) {
    if (visibleUuids.has(uuid)) continue;
    for (const src of full.inNeighbors(uuid)) {
      for (const tgt of full.outNeighbors(uuid)) {
        if (src !== tgt && !full.hasEdge(src, tgt)) {
          full.addEdge(src, tgt);
        }
      }
    }
    full.dropNode(uuid);
  }

  // Resolve N-shapes on the contracted visible graph.
  resolveNShapes(full);

  return full;
}

/**
 * Iteratively resolve N-shapes until the graph is series-parallel.
 * An N-shape is: P→R, P→S, Q→S exist, and Q cannot reach R.
 * (Transitive edges are not N-shapes — if Q can already reach R
 * via some path, the ordering is already implied.)
 * Resolution: add edge Q→R.
 */
function resolveNShapes(graph: Graph): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of graph.nodes()) {
      const inS = graph.inNeighbors(s);
      if (inS.length < 2) continue;
      for (const p of inS) {
        for (const r of graph.outNeighbors(p)) {
          if (r === s) continue;
          for (const q of inS) {
            if (q === p) continue;
            if (q === r) continue;
            // Only a real N-shape if Q cannot reach R at all
            // and adding Q→R wouldn't create a cycle (R cannot reach Q)
            if (!canReach(graph, q, r) && !canReach(graph, r, q)) {
              graph.addEdge(q, r);
              changed = true;
            }
          }
        }
      }
    }
  }
}

/** Check if source can reach target via any directed path. */
function canReach(graph: Graph, source: string, target: string): boolean {
  const visited = new Set<string>();
  const stack = [source];
  while (stack.length > 0) {
    const node = stack.pop() as string;
    if (node === target) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const neighbor of graph.outNeighbors(node)) {
      if (!visited.has(neighbor)) stack.push(neighbor);
    }
  }
  return false;
}

export function addPrerequisite(
  actions: Action[],
  priorities: Priority[],
  fromUuid: string,
  toUuid: string,
): void {
  const target = actions.find((a) => a.uuid === toUuid);
  if (!target) throw new Error(`Action not found: ${toUuid}`);
  if (target.prerequisites.some((p) => p.uuid === fromUuid)) return;
  const graph = computeWorkOrder(actions, priorities);
  if (wouldCreateCycle(graph, fromUuid, toUuid)) {
    throw new Error(
      `Cannot add prerequisite: ${fromUuid} → ${toUuid} would create a cycle`,
    );
  }
  target.prerequisites.push({ uuid: fromUuid, createdAt: Date.now() });
}

export function addPriority(
  actions: Action[],
  priorities: Priority[],
  higherUuid: string,
  lowerUuid: string,
): void {
  if (priorities.some((p) => p.higher === higherUuid && p.lower === lowerUuid))
    return;
  const graph = computeWorkOrder(actions, priorities);
  if (wouldCreateCycle(graph, higherUuid, lowerUuid)) {
    throw new Error(
      `Cannot add priority: ${higherUuid} → ${lowerUuid} would create a cycle`,
    );
  }
  priorities.push({
    higher: higherUuid,
    lower: lowerUuid,
    createdAt: Date.now(),
  });
}

export function removePrerequisite(
  actions: Action[],
  fromUuid: string,
  toUuid: string,
): void {
  const target = actions.find((a) => a.uuid === toUuid);
  if (!target) throw new Error(`Action not found: ${toUuid}`);
  const idx = target.prerequisites.findIndex((p) => p.uuid === fromUuid);
  if (idx === -1) throw new Error(`No prerequisite ${fromUuid} on ${toUuid}`);
  target.prerequisites.splice(idx, 1);
}

export function removePriority(
  priorities: Priority[],
  higherUuid: string,
  lowerUuid: string,
): void {
  const idx = priorities.findIndex(
    (p) => p.higher === higherUuid && p.lower === lowerUuid,
  );
  if (idx === -1)
    throw new Error(`No priority ${higherUuid} over ${lowerUuid}`);
  priorities.splice(idx, 1);
}
