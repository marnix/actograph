# Technical Debt

Known weaknesses, roughly ordered by risk of bugs slipping through.

## Data integrity

1. **ID collision undetected** — `generateActionId()` never checks if the generated ID already exists. Collision probability is low (~1 in 2.5M) but nonzero; a collision would silently overwrite an existing action.

2. **Dangling prerequisites/priorities** — If an action is removed or its ID changes, prerequisite/priority references to it become orphaned. `computeWorkOrder` silently skips them, but there's no cleanup or warning. Could accumulate after merges.

3. **No stale-lock detection** — If a process crashes while holding the hard-link lock, the lock file is never cleaned up. Next invocation spins for 30 seconds then fails. No check for lock file age.

## Correctness under change

4. **`Action` objects constructed in many places with no factory** — The `Action` interface is built inline in `index.ts`, test files, and the test helper, each with different signatures for their `makeAction` helpers. Adding a field to `Action` requires updating 5+ sites; TypeScript won't catch missing optional fields.

5. **Domain rules split between layers** — The tag-action state guard is in the domain (good), but other validations are missing or CLI-only. E.g., nothing prevents creating duplicate tag actions (`acto do '++urgent'` twice), which causes ambiguous lookups.

## Maintainability

6. **No "show single action" command** — No way to inspect one action's full state, prerequisites, and priority relations without reading `list` output and mentally correlating IDs.

## Scalability

7. **O(n×p) in `expandTagRelations`** — Uses `actions.find()` inside a loop over priorities. Fine at current scale, will degrade with hundreds of actions and priorities.

8. **Quadratic SP decomposition** — `spDecompose` has `MAX_ITER = (n+2)² + 100` with inner loops scanning all nodes/edges. Unlikely to matter at current scale but won't scale to large graphs.
