// Build annotation maps and format labels for the list command.
//
// Annotations are keyed by UUID internally; display uses slugs.

import type { Action } from "../domain/action.js";
import type { Priority } from "../domain/priority.js";
import { expandTagRelations } from "../domain/work-order.js";

export interface Annotations {
  reqPreds: Map<string, Set<string>>; // uuid → set of prerequisite uuids
  prioPreds: Map<string, Set<string>>; // uuid → set of higher-priority uuids
  slugByUuid: Map<string, string>; // uuid → slug for display
}

/** Build req/prio predecessor maps for visible actions. */
export function buildAnnotations(
  visible: Action[],
  allActions: Action[],
  priorities: Priority[],
): Annotations {
  const visibleUuids = new Set(visible.map((a) => a.uuid));
  const slugByUuid = new Map(visible.map((a) => [a.uuid, a.slug]));
  const reqPreds = new Map<string, Set<string>>();
  const prioPreds = new Map<string, Set<string>>();

  for (const a of visible) {
    for (const p of a.prerequisites) {
      if (visibleUuids.has(p.uuid)) {
        if (!reqPreds.has(a.uuid)) reqPreds.set(a.uuid, new Set());
        reqPreds.get(a.uuid)!.add(p.uuid);
      }
    }
  }

  const allPrios = [
    ...priorities,
    ...expandTagRelations(allActions, priorities).extraPrios,
  ];
  for (const p of allPrios) {
    if (visibleUuids.has(p.higher) && visibleUuids.has(p.lower)) {
      if (!prioPreds.has(p.lower)) prioPreds.set(p.lower, new Set());
      prioPreds.get(p.lower)!.add(p.higher);
    }
  }

  return { reqPreds, prioPreds, slugByUuid };
}

const STATE_MARKS: Record<string, string> = {
  done: "✓",
  active: "▶",
  skipped: "–",
};

function annotationSuffix(
  uuid: string,
  { reqPreds, prioPreds, slugByUuid }: Annotations,
): string {
  const parts: string[] = [];
  const reqs = reqPreds.get(uuid);
  if (reqs)
    parts.push(...Array.from(reqs).map((r) => `req:${slugByUuid.get(r) ?? r}`));
  const prios = prioPreds.get(uuid);
  if (prios)
    parts.push(
      ...Array.from(prios).map((p) => `prio:${slugByUuid.get(p) ?? p}`),
    );
  return parts.length > 0 ? `  ← ${parts.join(", ")}` : "";
}

/** Format a label for a regular action in list output. */
export function formatActionLabel(
  action: Action,
  annotations: Annotations,
): string {
  const mark = STATE_MARKS[action.state] ?? " ";
  const suffix = annotationSuffix(action.uuid, annotations);
  return `[${mark}] ${action.title}  (${action.slug})${suffix}`;
}

/** Format a label for a tag action in list --tags output. */
export function formatTagLabel(
  action: Action,
  annotations: Annotations,
): string {
  const suffix = annotationSuffix(action.uuid, annotations);
  return `${action.title}  (${action.slug})${suffix}`;
}
