# CLI Command Design

Design decisions for the `acto` command-line interface.

## Dependency and Priority Commands

Actions are listed in **work order** (the order they should be done):

- `acto req A B C` — A is required by B, B is required by C
- `acto prio A B C` — A has priority over B, B has priority over C

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

`req` and `prio`, as standalone commands — not as abbreviations or prefixes of longer command names. This avoids the `pri`/`pre` visual similarity problem and keeps things simple.

## Action Lifecycle Commands

Commands for managing action state:

- `acto do <title>` — Create a new action (state: Open)
- `acto go <id>` — Start working on an action (Open → Active)
- `acto done <id>` — Mark an action as done (→ Done)
- `acto donot <id>` — Pause an active action (Active → Open)
- `acto skip <id>` — Skip an action (→ Skipped)
- `acto redo <id>` — Reopen a done or skipped action (→ Open)
- `acto list` — Show all actions in SP work order

State indicators in `list` output: `[ ]` Open, `[▶]` Active, `[✓]` Done, `[–]` Skipped.
