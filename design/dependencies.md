# Dependencies

Two types of relationships between actions: prerequisites and priorities.

## Prerequisites (`req`)

`acto req A B` means "A is required by B" — A must be Done or Skipped before B can be completed.

Prerequisites are owned by the dependent action (B). If B is skipped/deleted, the relationship goes away. A doesn't know or care that B needed it.

Stored as a list on each action:

```typescript
interface Prerequisite {
  uuid: string; // the required action's UUID
  createdAt: number; // milliseconds since epoch (Date.now())
}

interface Action {
  uuid: string;
  slug: string; // human-friendly CVCVCVC identifier
  title: string;
  state: ActionState; // "open" | "active" | "done" | "skipped"
  prerequisites: Prerequisite[];
}
```

## Priorities (`prio`)

`acto prio A B` means "A has priority over B" — A should be worked on before B, but there is no hard dependency between them.

Priorities are not owned by either action. They are an external assertion about relative ordering, stored as a separate top-level list:

```typescript
interface Priority {
  higher: string; // action UUID
  lower: string; // action UUID
  createdAt: number; // milliseconds since epoch (Date.now())
}

interface ActographDoc {
  actions: Record<string, Action>; // keyed by UUID
  priorities: Priority[];
}
```

## Timestamps and Cycle Resolution

Every dependency (both `req` and `prio`) records its creation time in milliseconds since epoch, using the local wall clock.

Cycle resolution is built into the work order computation (`src/domain/work-order.ts`): prerequisite edges are added first, then priority edges are added oldest-first, skipping any that would create a cycle. This means prerequisite ordering always wins over priority, and among conflicting priorities the older one takes precedence.

Note: transitivity does not compose across relation types. If A has priority over B, and B is required by C, that does NOT imply A is before C in the work order. Each relation's transitivity is computed independently.

## Work Order Display

The work order graph is decomposed into a series-parallel (SP) tree (`src/domain/sp-decompose.ts`) using edge contraction (Valdes-Tarjan-Lawler style). Non-SP graphs fall back to topological layering. The SP tree is rendered as ASCII with `>>` (sequential) and `||` (parallel) markers (`src/domain/render-sp.ts`).

## Tag Inheritance

Tags (`++tagname` in action titles) introduce virtual edges into the work order:

- **Prerequisite inheritance**: if a tag action (title is only `++tagname`) has prerequisites, those are inherited by all actions whose title mentions that tag.
- **Priority inheritance**: if tag action A has priority over tag action B, every member of A's tag gets priority over every member of B's tag.

Tag expansion is computed dynamically by `expandTagRelations()` in `src/domain/work-order.ts` — no stored expansion. This means editing an action's title to add or remove `++tag` tokens immediately changes its position in the work order.

Tag actions themselves are not real work items: they cannot change state and are excluded from the default `list` output.

## Automerge Considerations

- Prerequisites (list on each action): concurrent additions from different devices merge cleanly via Automerge's list CRDT.
- Priorities (top-level list): concurrent additions append independently, no conflicts. Application logic handles dedup and cycle detection.
- Timestamps use the local wall clock (`Date.now()`), which is sufficient for single-user and small-team use.
