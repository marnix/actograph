# CLI Command Design

Design decisions for the `acto` command-line interface.

## Dependency and Priority Commands

Actions are listed in **work order** (the order they should be done):

- `acto req A B C` — A is required by B, B is required by C
- `acto unreq A B C` — Remove A→B and B→C prerequisites
- `acto prio A B C` — A has priority over B, B has priority over C
- `acto unprio A B C` — Remove A>B and B>C priority relations

The 2-argument form is just a special case: `acto req A B` means "A is required by B".

### Design Rationale

We considered verb-based commands like `acto needs A B` or `acto before A B`, but found that prefix-verb-object ordering (`before A B`) reads unnaturally. Instead, `req` and `prio` are short noun-ish abbreviations that don't try to form a sentence. The mental model is simply "list things in work order".

Alternatives considered for the dependency command:

- `dep` — too generic, doesn't convey direction
- `pre` / `prereq` / `prerequisite` — good words, but `pre` is too similar to `pri`/`prio` (one vowel apart, easy to mistype/misread)
- `need` / `feeds` / `blocks` / `unlocks` — verb forms that read awkwardly as `verb A B`

Alternatives considered for the priority command:

- `before` — could be confused with dependency
- `rank` / `above` / `over` — decent but less immediately clear

### Current Choice

`req` and `prio`, as standalone commands — not as abbreviations or prefixes of longer command names. This avoids the `pri`/`pre` visual similarity problem and keeps things simple. Their inverses are `unreq` and `unprio`.

### Validation

- **State transitions**: CLI commands reject invalid transitions (e.g., `go` on a Done action). Valid transitions are defined in the domain layer (`canTransition`).
- **Cycle prevention**: `req` and `prio` reject edges that would create a cycle in the work order graph.

## Action Lifecycle Commands

Commands for managing action state:

- `acto do [title]` — Create a new action (state: Open). If title is omitted, prompts interactively
- `acto edit <slug> [new-title]` — Edit an action's title. If `new-title` is omitted, opens interactive readline editing with the current title pre-filled. Tag actions cannot be edited, and an action cannot be changed to a tag-only title
- `acto go <slug>` — Start working on an action (Open → Active)
- `acto stop <slug>` — Pause an active action (Active → Open)
- `acto done <slug>` — Mark an action as done (Open/Active → Done)
- `acto donot <slug>` — Skip an action (Open/Active → Skipped)
- `acto redo <slug>` — Reopen a done or skipped action (→ Open)

## Listing Commands

- `acto list` — Show open/active actions in SP work order
- `acto list -a` — Show all actions including done and skipped
- `acto list ++tag` — Show only actions carrying the given tag
- `acto list -t` / `acto list --tags` — Show only tag actions in SP work order

State indicators in `list` output: `[ ]` Open, `[▶]` Active, `[✓]` Done, `[–]` Skipped.

Dependency annotations appear as suffixes: `← req:takapup, prio:zebepod`. Tag-inherited priority relations also appear as `prio:` annotations.

When filtering (default, without `-a`), transitive ordering through hidden (done/skipped) actions is preserved. Tag actions are always excluded from `list` and `list -a`; use `list --tags` to see them.

## Tags

Action titles can include `++tagname` tokens inline (e.g., `"Fix login ++urgent"`). An action whose title is _only_ a tag (e.g., `"++urgent"`) is a **tag action**.

Tag actions:

- Cannot be started, completed, skipped, or edited (state and edit commands are blocked)
- Are hidden from `list` and `list -a`; shown only via `list --tags`
- Can participate in `req` and `prio` relationships
- Can be referenced by their tag title (e.g., `acto prio '++urgent' '++backlog'`)

### Tag Inheritance

- If a tag action has prerequisites, every action mentioning that tag inherits those prerequisites
- If tag action A has priority over tag action B, every action tagged with A's tag gets priority over every action tagged with B's tag
- Inheritance is not transitive across tags (tag A's relations don't propagate through tag B)
- Tag inheritance is computed dynamically from titles at work-order time — no stored expansion

### Slug Lookup

All commands that accept action slugs also accept `++tagname` to look up a tag action by its title. This allows natural usage like:

```
acto do '++urgent'
acto do '++backlog'
acto prio '++urgent' '++backlog'
```
