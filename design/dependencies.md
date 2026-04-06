# Dependencies

Two types of relationships between actions: prerequisites and priorities.

## Prerequisites (`req`)

`acto req A B` means "A is required by B" — A must be Done or Skipped before B can be completed.

Prerequisites are owned by the dependent action (B). If B is skipped/deleted, the relationship goes away. A doesn't know or care that B needed it.

Stored as a list on each action:

```typescript
interface Prerequisite {
  actionId: string; // the required action's ID
  createdAt: number; // milliseconds since epoch (Date.now())
}

interface Action {
  id: string;
  title: string;
  completed: boolean;
  prerequisites: Prerequisite[];
}
```

## Priorities (`prio`)

`acto prio A B` means "A has priority over B" — A should be worked on before B, but there is no hard dependency between them.

Priorities are not owned by either action. They are an external assertion about relative ordering, stored as a separate top-level list:

```typescript
interface Priority {
  higher: string; // action ID
  lower: string; // action ID
  createdAt: number; // milliseconds since epoch (Date.now())
}

interface ActographDoc {
  actions: Record<string, Action>;
  priorities: Priority[];
}
```

## Timestamps and Cycle Resolution

Every dependency (both `req` and `prio`) records its creation time in milliseconds since epoch, using the local wall clock.

When a cycle is detected (e.g., A→B→C→A), it can be resolved by ignoring the most recently created edge — the one that introduced the cycle. In case of exact timestamp ties, fall back to a deterministic tiebreaker (e.g., lexicographic comparison of the involved action IDs).

## Automerge Considerations

- Prerequisites (list on each action): concurrent additions from different devices merge cleanly via Automerge's list CRDT.
- Priorities (top-level list): concurrent additions append independently, no conflicts. Application logic handles dedup and cycle detection.
- Timestamps use the local wall clock (`Date.now()`), which is sufficient for single-user and small-team use.
