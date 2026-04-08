# Technical Debt

Known weaknesses, roughly ordered by risk of bugs slipping through.

## Data integrity

1. **Dangling prerequisites/priorities** — If an action is removed or its UUID changes, prerequisite/priority references to it become orphaned. `computeWorkOrder` silently skips them. Warned at load time but not auto-cleaned; could accumulate after merges.

## Scalability

2. **O(n×p) in `expandTagRelations`** — Uses `actions.find()` inside a loop over priorities. Fine at current scale, will degrade with hundreds of actions and priorities.

3. **Quadratic SP decomposition** — `spDecompose` has `MAX_ITER = (n+2)² + 100` with inner loops scanning all nodes/edges. Unlikely to matter at current scale but won't scale to large graphs.
