// Build annotation maps and format labels for the list command.

import type { Action } from "../domain/action.js";
import type { Priority } from "../domain/priority.js";
import { expandTagRelations } from "../domain/work-order.js";

export interface Annotations {
  reqPreds: Map<string, Set<string>>;
  prioPreds: Map<string, Set<string>>;
}

/** Build req/prio predecessor maps for visible actions. */
export function buildAnnotations(
  visible: Action[],
  allActions: Action[],
  priorities: Priority[],
): Annotations {
  const visibleIds = new Set(visible.map((a) => a.id));
  const reqPreds = new Map<string, Set<string>>();
  const prioPreds = new Map<string, Set<string>>();

  for (const a of visible) {
    for (const p of a.prerequisites) {
      if (visibleIds.has(p.actionId)) {
        if (!reqPreds.has(a.id)) reqPreds.set(a.id, new Set());
        reqPreds.get(a.id)!.add(p.actionId);
      }
    }
  }

  const allPrios = [
    ...priorities,
    ...expandTagRelations(allActions, priorities).extraPrios,
  ];
  for (const p of allPrios) {
    if (visibleIds.has(p.higher) && visibleIds.has(p.lower)) {
      if (!prioPreds.has(p.lower)) prioPreds.set(p.lower, new Set());
      prioPreds.get(p.lower)!.add(p.higher);
    }
  }

  return { reqPreds, prioPreds };
}

const STATE_MARKS: Record<string, string> = {
  done: "✓",
  active: "▶",
  skipped: "–",
};

function annotationSuffix(
  id: string,
  { reqPreds, prioPreds }: Annotations,
): string {
  const parts: string[] = [];
  const reqs = reqPreds.get(id);
  if (reqs) parts.push(...Array.from(reqs).map((r) => `req:${r}`));
  const prios = prioPreds.get(id);
  if (prios) parts.push(...Array.from(prios).map((p) => `prio:${p}`));
  return parts.length > 0 ? `  ← ${parts.join(", ")}` : "";
}

/** Format a label for a regular action in list output. */
export function formatActionLabel(
  action: Action,
  annotations: Annotations,
): string {
  const mark = STATE_MARKS[action.state] ?? " ";
  const suffix = annotationSuffix(action.id, annotations);
  return `[${mark}] ${action.title}  (${action.id})${suffix}`;
}

/** Format a label for a tag action in list --tags output. */
export function formatTagLabel(
  action: Action,
  annotations: Annotations,
): string {
  const suffix = annotationSuffix(action.id, annotations);
  return `${action.title}  (${action.id})${suffix}`;
}
