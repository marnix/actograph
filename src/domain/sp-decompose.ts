// Series-parallel decomposition of a directed acyclic graph.
//
// Uses edge contraction (Valdes-Tarjan-Lawler style): repeatedly apply
// series and parallel reductions until the graph is a single edge.
// For non-SP graphs, falls back to topological layering.

import Graph from "graphology";

export type SPNode =
  | { type: "action"; id: string }
  | { type: "seq"; children: SPNode[] }
  | { type: "par"; children: SPNode[] };

// Validate that every seq/par has at least 2 children
function assertValid(node: SPNode): void {
  if (node.type === "action") return;
  if (node.children.length < 2) {
    throw new Error(
      `${node.type} node must have at least 2 children, got ${node.children.length}`,
    );
  }
  for (const child of node.children) assertValid(child);
}

// Flatten nested seq-in-seq and par-in-par, and unwrap single-child wrappers
function flatten(node: SPNode): SPNode {
  if (node.type === "action") return node;
  const flatChildren: SPNode[] = [];
  for (const child of node.children) {
    const fc = flatten(child);
    if (fc.type === node.type) {
      flatChildren.push(...fc.children);
    } else {
      flatChildren.push(fc);
    }
  }
  if (flatChildren.length === 1) return flatChildren[0]!;
  return { type: node.type, children: flatChildren };
}

// The reduction works on a multigraph where each edge carries an SPNode label.
// We add virtual source/sink, then reduce.
// Key insight: each edge label represents the "content" between its endpoints,
// NOT including the endpoints themselves.

export function spDecompose(workOrder: Graph): SPNode {
  const nodes = workOrder.nodes();
  if (nodes.length === 0)
    return { type: "par", children: [] } as unknown as SPNode;
  if (nodes.length === 1) return { type: "action", id: nodes[0]! };

  // Each node gets an SPNode label (what it "means")
  const nodeLabel = new Map<string, SPNode>();
  for (const id of nodes) nodeLabel.set(id, { type: "action", id });

  // Edge storage: from -> to -> list of SPNode labels (content between endpoints)
  // null label means "direct connection, no content between"
  type Label = SPNode | null;
  const edges = new Map<string, Map<string, Label[]>>();
  const allNodes = new Set<string>();

  function ensureNode(id: string): void {
    allNodes.add(id);
    if (!edges.has(id)) edges.set(id, new Map());
  }

  function addEdge(from: string, to: string, label: Label): void {
    ensureNode(from);
    ensureNode(to);
    const m = edges.get(from)!;
    if (!m.has(to)) m.set(to, []);
    m.get(to)!.push(label);
  }

  function getLabels(from: string, to: string): Label[] {
    return edges.get(from)?.get(to) ?? [];
  }

  function setLabels(from: string, to: string, labels: Label[]): void {
    ensureNode(from);
    if (labels.length === 0) {
      edges.get(from)!.delete(to);
    } else {
      edges.get(from)!.set(to, labels);
    }
  }

  function outNeighbors(id: string): string[] {
    const m = edges.get(id);
    if (!m) return [];
    return [...m.keys()].filter((k) => (m.get(k)?.length ?? 0) > 0);
  }

  function inNeighbors(id: string): string[] {
    const result: string[] = [];
    for (const [from, targets] of edges) {
      if (from !== id && (targets.get(id)?.length ?? 0) > 0) {
        result.push(from);
      }
    }
    return result;
  }

  function removeNode(id: string): void {
    edges.delete(id);
    allNodes.delete(id);
    for (const targets of edges.values()) {
      targets.delete(id);
    }
  }

  const VSRC = "__vsrc__";
  const VSNK = "__vsnk__";
  ensureNode(VSRC);
  ensureNode(VSNK);

  // Initialize edges from original graph (label = null, meaning direct)
  for (const id of nodes) ensureNode(id);
  workOrder.forEachEdge((_e, _a, source, target) => {
    addEdge(source, target, null);
  });

  // Connect virtual source to all source nodes, virtual sink from all sink nodes
  for (const id of nodes) {
    if (workOrder.inDegree(id) === 0) addEdge(VSRC, id, null);
    if (workOrder.outDegree(id) === 0) addEdge(id, VSNK, null);
  }

  // Build a series label: the content between pred and succ going through mid
  function seriesLabel(
    predToMid: Label[],
    midNode: SPNode,
    midToSucc: Label[],
  ): Label[] {
    const results: Label[] = [];
    for (const inL of predToMid) {
      for (const outL of midToSucc) {
        const parts: SPNode[] = [];
        if (inL !== null) parts.push(inL);
        parts.push(midNode);
        if (outL !== null) parts.push(outL);
        if (parts.length === 0) {
          results.push(null);
        } else if (parts.length === 1) {
          results.push(parts[0]!);
        } else {
          results.push({ type: "seq", children: parts });
        }
      }
    }
    return results;
  }

  // Reduction loop: do one reduction at a time, prioritizing parallel over series
  const MAX_ITER = (nodes.length + 2) * (nodes.length + 2) + 100;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let reduced = false;

    // Parallel reduction: multiple edges between same (from, to)
    for (const from of [...allNodes]) {
      if (reduced) break;
      for (const to of outNeighbors(from)) {
        const labels = getLabels(from, to);
        if (labels.length > 1) {
          const nonNull = labels.filter((l): l is SPNode => l !== null);
          if (nonNull.length === 0) {
            // All direct connections — collapse to single null
            setLabels(from, to, [null]);
          } else if (nonNull.length === 1) {
            setLabels(from, to, [nonNull[0]!]);
          } else {
            const merged: SPNode = { type: "par", children: nonNull };
            setLabels(from, to, [merged]);
          }
          reduced = true;
          break;
        }
      }
    }
    if (reduced) continue;

    // Series reduction: node with exactly one predecessor and one successor
    for (const node of [...allNodes]) {
      if (node === VSRC || node === VSNK) continue;
      const ins = inNeighbors(node);
      const outs = outNeighbors(node);
      if (ins.length === 1 && outs.length === 1) {
        const pred = ins[0]!;
        const succ = outs[0]!;
        const inLabels = getLabels(pred, node);
        const outLabels = getLabels(node, succ);
        const mid = nodeLabel.get(node)!;
        const newLabels = seriesLabel(inLabels, mid, outLabels);
        for (const l of newLabels) addEdge(pred, succ, l);
        removeNode(node);
        reduced = true;
        break;
      }
    }

    if (!reduced) break;
  }

  // Check if fully reduced
  const finalLabels = getLabels(VSRC, VSNK);
  if (finalLabels.length === 1) {
    const [label] = finalLabels as [Label];
    // The label is the content between VSRC and VSNK.
    // If null, all nodes were sources AND sinks (shouldn't happen with 2+ nodes).
    // Otherwise, wrap: the label might not include the source/sink nodes if they
    // were directly connected to VSRC/VSNK.
    if (label === null) {
      // All nodes are independent
      const children = nodes.map((id) => ({ type: "action" as const, id }));
      if (children.length === 1) return children[0]!;
      const result: SPNode = { type: "par", children };
      assertValid(result);
      return result;
    }
    const result = flatten(label);
    if (result.type !== "action") assertValid(result);
    return result;
  }

  // Not fully SP — fallback
  return fallbackDecompose(workOrder);
}

function fallbackDecompose(workOrder: Graph): SPNode {
  const nodes = workOrder.nodes();
  if (nodes.length === 1) return { type: "action", id: nodes[0]! };

  const inDeg = new Map<string, number>();
  for (const n of nodes) inDeg.set(n, workOrder.inDegree(n));

  const layers: string[][] = [];
  const remaining = new Set(nodes);

  while (remaining.size > 0) {
    const layer = [...remaining].filter((n) => (inDeg.get(n) ?? 0) === 0);
    if (layer.length === 0) {
      layers.push([...remaining]);
      break;
    }
    layers.push(layer);
    for (const n of layer) {
      remaining.delete(n);
      for (const succ of workOrder.outNeighbors(n)) {
        inDeg.set(succ, (inDeg.get(succ) ?? 0) - 1);
      }
    }
  }

  const spLayers: SPNode[] = layers.map((layer) => {
    if (layer.length === 1) return { type: "action" as const, id: layer[0]! };
    return {
      type: "par" as const,
      children: layer.map((id) => ({ type: "action" as const, id })),
    };
  });

  if (spLayers.length === 1) return spLayers[0]!;
  const result: SPNode = { type: "seq", children: spLayers };
  assertValid(result);
  return result;
}
