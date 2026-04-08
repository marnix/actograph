# Technical Debt

Known weaknesses, roughly ordered by risk of bugs slipping through.

## Data integrity

1. **Dangling prerequisites/priorities** — If an action is removed or its UUID changes, prerequisite/priority references to it become orphaned. `computeWorkOrder` silently skips them, but there's no cleanup or warning. Could accumulate after merges.

2. **No stale-lock detection** — If a process crashes while holding the hard-link lock, the lock file is never cleaned up. Next invocation spins for 30 seconds then fails. No check for lock file age.

## Correctness under change

3. **Domain rules split between layers** — The tag-action state guard is in the domain (good), but other validations are missing or CLI-only. E.g., nothing prevents creating duplicate tag actions (`acto do '++urgent'` twice), which causes ambiguous lookups.

## Maintainability

4. **No "show single action" command** — No way to inspect one action's full state, prerequisites, and priority relations without reading `list` output and mentally correlating IDs.

## Scalability

5. **O(n×p) in `expandTagRelations`** — Uses `actions.find()` inside a loop over priorities. Fine at current scale, will degrade with hundreds of actions and priorities.

6. **Quadratic SP decomposition** — `spDecompose` has `MAX_ITER = (n+2)² + 100` with inner loops scanning all nodes/edges. Unlikely to matter at current scale but won't scale to large graphs.
