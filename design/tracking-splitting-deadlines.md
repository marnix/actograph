# Tracking Actions, Splitting, and Deadlines

Design for features that let actograph handle sub-tasks, automatic
state tracking, deadlines, and structured tag values — without adding
workflow states or special-purpose fields.

## Design Principle

Keep the core model minimal. New workflows should emerge from
combining a small number of orthogonal features, rather than from
dedicated fields for every concept (assignee, due date, sprint,
story points, etc.) that traditional systems accumulate.

The features below are all variations on one theme: **actions whose
state or meaning is derived from their relationships and tags,
rather than from manual state management.**

## 1. Tracking Actions

A **tracking action** is an action whose state is automatically
computed from its prerequisites. It represents "all of these things
need to happen" without being work itself.

### Data Model

A boolean flag on the action:

```typescript
interface Action {
  // ...existing fields...
  tracking: boolean; // state derived from prerequisites
}
```

`tracking` defaults to `false` for all existing and new actions.

### Computed State

The state of a tracking action is never stored — it is derived on
every read:

| Prerequisite states          | Tracking action state |
|------------------------------|-----------------------|
| Any prerequisite is Active   | Active                |
| All prerequisites are Done   | Done                  |
| All prerequisites are Skipped| Skipped               |
| Mix of Done and Skipped      | Done                  |
| Any prerequisite is Open     | Open                  |
| No prerequisites             | Open                  |

Rationale for "mix of Done and Skipped → Done": the tracking action
represents a goal. If some sub-tasks were completed and the rest
were deliberately skipped, the goal is achieved.

Rationale for "all Skipped → Skipped": if every sub-task was
abandoned, the parent goal was abandoned too — not achieved.

### Constraints

- Manual state transitions (`go`, `done`, `donot`, `redo`) are
  rejected on tracking actions, like they are on tag actions.
- `edit` is allowed (the title is still user-controlled).
- A tracking action with no prerequisites stays Open (it has no
  information to derive state from). This is a degenerate case,
  not an error.

### Interaction with Tag Actions

Tag actions and tracking actions are orthogonal concepts:

- A tag action (title is only `++tagname`) cannot be a tracking
  action — tag actions are immutable ordering anchors.
- A tracking action can mention tags in its title like any other
  action.

### Nested Tracking

A tracking action whose prerequisite is also a tracking action
works naturally: the inner tracking action's computed state feeds
into the outer one's derivation. No special handling needed — the
recursion bottoms out at non-tracking actions.

This enables epic → story → task hierarchies where each level
auto-tracks the level below.

## 2. Splitting and Moving Actions

### Splitting

**Splitting** converts an action into a tracking action with one or
more new sub-actions as its prerequisites.

#### CLI Command

```
acto split <parent> <child-title> [<child-title>...]
```

Behavior:

1. Creates each child as a new Open action.
2. Adds each child as a prerequisite of `<parent>`.
3. Sets `tracking: true` on `<parent>` if not already set.

If `<parent>` is already a tracking action with existing children,
the new children are added alongside them. This supports
incremental decomposition — you don't have to know all sub-tasks
up front.

If `<parent>` was Active, its derived state will remain Active only
if a child is started; otherwise it reverts to Open (since all
children are Open). This is correct — the parent's progress is now
defined by its children.

### Moving Sub-tasks

```
acto move <child> <new-parent>
```

Shorthand for `unreq child old-parent` + `req child new-parent`.
Finds the child's current parent(s) — actions that have `child` as
a prerequisite — removes those edges, and adds a new prerequisite
edge to `new-parent`.

If the child has multiple parents (is a prerequisite of several
actions), `move` is ambiguous. Options:

- Error: "child has multiple dependents, use unreq/req explicitly"
- Flag: `acto move child new-parent --from old-parent`

The first option is simpler and avoids surprises.

### Complementary Commands

```
acto track <slug>     # convert an action to tracking
acto untrack <slug>   # revert to manual state management
```

`track` is useful when you've already created sub-actions via
`do` + `req` and want to retroactively make the parent track them.

`untrack` is the escape hatch — if you realize the parent needs
manual control again (e.g., it has its own work beyond the
sub-tasks). The action gets the last computed state at the moment
of untracking.

### Command Naming Convention

Commands like `split`, `move`, `track`, `untrack` are **helper
commands** — convenience operations that can also be achieved via
combinations of primitive commands (`do`, `req`, `unreq`, `edit`).

_Idea:_ Distinguish helper commands from primitives in the CLI,
e.g. by spelling them differently or grouping them. Options:

- Prefix: `acto x:split`, `acto x:move` (ugly but explicit)
- Longer names: helpers are multi-syllable (`split`, `move`,
  `track`), primitives are short (`do`, `go`, `req`, `prio`)
- No distinction: just document which are helpers

The current naming already falls naturally into this pattern —
primitives are 2–5 letter verbs (`do`, `go`, `req`, `prio`,
`done`, `stop`, `redo`, `edit`), while helpers are longer
(`split`, `track`, `untrack`, `move`). This may be sufficient
without any explicit convention.

### Workflow Examples

**Splitting a large action:**

```bash
acto do "Ship v2.0"
# realize it's too big:
acto split taka "Write migration guide" "Update API docs"
# taka is now tracking, with two Open children

# later, realize there's more:
acto split taka "Run load tests"
# third child added to existing tracking action
```

**Moving a sub-task:**

```bash
acto split epic1 "Design API" "Implement API" "Write docs"
acto split epic2 "Design UI" "Implement UI"
# realize "Write docs" belongs with the UI epic:
acto move docs epic2
```

**Replacing an action with a refined version:**

```bash
acto do "Fix login bug"
# after investigation, the fix is two things:
acto split fix "Add null check in auth handler" "Add regression test"
# just complete the children — fix auto-completes
```

**Adding a verification step:**

```bash
acto do "Refactor parser"
acto do "Verify parser refactoring"
acto req refac verify
# refac stays a normal (non-tracking) action — it has its own work
```

## 3. Structured Tags: `++key:value` and Dates

### Extended Tag Syntax

Widen the tag pattern to allow `:`, `-`, and `.` so that tags can
carry structured values:

```
++tagname           simple tag (existing)
++key:value         key-value tag
++2026-07-3         date tag (deadline)
++release:2026.04   versioned key-value tag
```

New tag pattern: `\+\+([\w][\w:.\-]*)` — must start with a word
character, then allows `\w`, `:`, `.`, `-`.

This is a **syntax extension only** — the domain model does not
distinguish simple tags from key-value tags. A tag is still just a
string. The structure is a convention, not enforced by the system.

### Tag Pattern Change

Current: `\+\+(\w+)` — matches `++word` only.

Proposed: `\+\+([\w][\w:.\-]*)` — matches `++word`, `++key:value`,
`++2026-07-3`, `++release:2026.04`.

This is backward-compatible: all existing `++tagname` tokens still
match. The change only allows new characters after the first `\w`.

### Slug References as Tags

_Idea:_ Allow `++theslug` in a title to reference any action by
its slug, not just tag actions. This would create an implicit
"related to" link without a `req` or `prio` edge.

Use cases:

- `acto do "Follow-up to ++takapup: check edge cases"` — the
  slug reference is informational, visible in the title.
- `acto list ++takapup` could show the referenced action and all
  actions that mention it.

This overloads the `++` syntax: currently `++foo` always means
"tag named foo." If slugs and tag names can collide, lookup
becomes ambiguous. Options:

- **No collision possible**: tag names use `\w` characters and
  slugs are CVCVCVC — the patterns are different enough that
  collisions are unlikely but not impossible (e.g., a tag named
  `++takapup`).
- **Explicit prefix**: `++@takapup` for slug references vs
  `++tagname` for tags. Keeps the namespaces separate.
- **Unified lookup**: `++X` first checks tag actions, then slugs.
  Tag actions take precedence.

This is an interesting idea but adds complexity. Deferred until
the tag system is more mature. For now, mentioning a slug in
plain text (`"Follow-up to takapup: check edge cases"`) is
sufficient — it's human-readable even if not machine-linked.

### Deadlines as Tags

A deadline is a tag action whose title is a date:

```bash
acto do '++2026-07-3'
acto req some-feature ++2026-07-3
```

This means "some-feature must be done before the 2026-07-3
deadline." The deadline participates in the work order like any
other tag action — it inherits prerequisites to its members and
can have priority relations.

No special date logic is needed in the domain layer. The date is
just a tag name that happens to look like a date. Future features
(overdue warnings, calendar views) can parse date-shaped tag names
without changing the model.

### Key-Value Tags as Custom Fields

The `++key:value` convention lets users model custom fields:

```bash
acto do "Ship login redesign ++release:2026.04 ++team:frontend"
acto do "Fix auth timeout ++release:2026.04 ++team:backend"
acto list ++release:2026.04    # all actions for this release
acto list ++team:frontend      # all frontend actions
```

Each `++key:value` pair is a separate tag. `++release:2026.04` and
`++release:2026.07` are two different tags, not two values of a
"release" field. This is intentional — it avoids the need for
field definitions, field types, or field validation.

Tag actions for key-value tags work the same as for simple tags:

```bash
acto do '++release:2026.04'
acto do '++release:2026.07'
acto prio '++release:2026.04' '++release:2026.07'
# all 2026.04 actions have priority over all 2026.07 actions
```

### Start Dates

_Open question._ Start dates could be modeled as:

- `++after:2026-05-01` tag on the action, with future UI support
  to hide actions whose `after:` date hasn't arrived.
- A prerequisite on a date-shaped action: `acto req ++2026-05-01
  my-action` — but this confuses "deadline" with "start after."
- A separate `++start:2026-05-01` convention, distinct from
  `++after:`, with different semantics (soft hint vs hard gate).

No decision yet. Start dates are deferred until the deadline
convention has been used in practice and we understand the
interaction patterns better.

## 4. External Tracking and Plug-ins

### External Things as Actions (Now)

External blockers — waiting for a vendor, waiting for a date,
waiting for an external system — are modeled as normal actions:

```bash
acto do "Wait for vendor security audit response"
acto req vendor-wait my-feature
# when the vendor responds:
acto done vendor-wait
```

This works but requires manual state management of the external
action. For date-based waits, a deadline tag action serves as the
anchor, but someone still has to notice the date has passed.

### External Tracking via Tracking Actions (Near-term)

A tracking action can represent an external item whose state is
derived from actograph sub-actions:

```bash
acto do "PROJ-453: Fix auth timeout"
acto track proj453
acto split proj453 "Implement fix" "Code review" "Deploy to staging"
```

The external Jira issue is represented by a tracking action. Its
state in actograph reflects the progress of the local sub-actions.
Syncing state back to Jira is manual.

### Plug-in System (Future)

A plug-in system could automate external tracking:

- **Jira plug-in**: creates/syncs tracking actions from Jira
  issues. State changes in actograph propagate back to Jira.
- **Calendar plug-in**: auto-resolves date-based actions when
  their date arrives.
- **Recurring plug-in**: creates new instances of recurring
  actions (see section 6).

Plug-in design is out of scope for now. The key insight is that
tracking actions provide the right abstraction layer — a plug-in
just needs to manage the prerequisites of a tracking action, and
the state derivation handles the rest.

## 5. Scenarios: Traditional Features via Actograph Primitives

How traditional project management concepts map to actograph's
minimal model.

### Sub-tasks

Traditional: parent issue with child issues, each with independent
state, parent shows progress bar.

Actograph: `acto split parent "child 1" "child 2"`. Parent becomes
a tracking action. Progress is visible from the children's states
in the work order.

### Milestones / Release Planning

Traditional: a milestone object with a due date, issues assigned
to it.

Actograph: `acto do '++release:2026.04'` creates a tag action.
Tag actions in titles (`acto do "Ship feature ++release:2026.04"`)
group work. `acto prio '++release:2026.04' '++release:2026.07'`
orders releases. A deadline can be attached:
`acto do '++2026-07-3'` then
`acto req '++release:2026.04' '++2026-07-3'`.

### Epics

Traditional: a large work item containing stories/tasks.

Actograph: a tracking action with sub-actions. Epics can nest:
split a tracking action's child into further sub-actions.

### Blocked / Waiting

Traditional: a "Blocked" status with a link to the blocker.

Actograph: `acto req blocker blocked-action`. The work order
naturally shows the blocker before the blocked action. No
separate status needed — the action stays Open, and the work
order communicates that it can't proceed yet.

#### Visibility of Blocked Actions

Rather than a separate `--blocked` filter, blocked actions should
be visible through the work order rendering itself. Ideas:

- **Indentation / nesting**: the planned indented sequential
  rendering (see README roadmap) would naturally show blocked
  actions indented under their blockers, making the dependency
  chain visually obvious.
- **Annotation**: `list` already shows `← req:slug` annotations.
  An action whose prerequisites are not all Done/Skipped could
  get a visual marker (e.g., `⏳` or `blocked`) in the
  annotation.
- **Dimming**: in a future TUI, blocked actions could be dimmed
  or grayed out while their blockers are prominent.

The work order already encodes "what's blocked on what" — the
rendering just needs to make it more visually salient. This is
a rendering concern, not a data model change.

### Related Actions

Traditional: "related to" links between issues (informational,
no ordering).

Actograph: no formal "related" relation. Options:

- Mention the other action's slug in the title:
  `"Follow-up to takapup: check edge cases"`. Human-readable,
  no tooling needed.
- Future: `++slug` references (see section 3) could make these
  machine-parseable.
- A third relation type (`rel`?) is possible but adds complexity
  for limited value — "related" links are rarely actionable.

For now, slug mentions in titles are sufficient.

### Duplicates

Traditional: mark issue as duplicate, link to original.

Actograph: `acto donot duplicate-action`. Optionally add a note
in the title: `acto edit dup "Duplicate of takapup: original title"`.
The skipped action is hidden from default listing.

### Verification / Review

Traditional: "Resolved → Verified" workflow states.

Actograph: create a verification action as a separate step:
`acto do "Verify: login fix works"` then
`acto req login-fix verify-login`. The original action is Done
when the implementer finishes; the verify action tracks the
review step.

### Priority Groups / Triage

Traditional: Priority field (P1/P2/P3) on each issue.

Actograph: tag actions `++p1`, `++p2`, `++p3` with priority
relations between them. Actions tagged `++p1` automatically
sort before `++p2` actions in the work order.

### Sprints / Iterations

Traditional: sprint object with start/end dates, issues assigned.

Actograph: `acto do '++sprint:2026-w17'` as a tag action. Actions
tagged with the sprint are grouped. Sprint ordering via
`acto prio '++sprint:2026-w17' '++sprint:2026-w18'`.

### External Issues (Jira, GitHub, etc.)

Traditional: issues live in the external system with their own
workflow states.

Actograph (now): create a tracking action representing the
external issue, with local sub-actions for the actual work.
Manual sync.

Actograph (future): plug-in creates and syncs tracking actions
automatically. See section 4.

## 6. Recurring Actions

Actions that repeat on a schedule: "review PRs every Monday",
"monthly security audit", "weekly team sync."

### The Problem

Actograph's model assumes actions move toward completion. A
recurring action contradicts this — it's never truly "done"
because it comes back.

### Possible Approaches

**A. Manual re-creation**: complete the action, then `redo` it
or create a new one. Simple but tedious and loses history.

**B. "Cannot be completed" action**: an action that rejects
`done` transitions. Each occurrence is a child action created
manually or by a helper command. The parent is a tracking action
that never fully completes because new children keep appearing.

```bash
acto do "Weekly PR review"
acto track weekly-pr
# each week:
acto split weekly-pr "PR review 2026-w17"
# complete the child when done; parent stays Open
# because there's always a next occurrence
```

Problem: the tracking action would show as Done when all current
children are Done, until the next child is created. This is
technically correct but misleading.

**C. Edit-and-roll-forward**: a single action whose title/deadline
is updated each cycle:

```bash
acto do "PR review ++2026-07-3"
# after completing:
acto done pr-review
acto redo pr-review
acto edit pr-review "PR review ++2026-07-10"
```

Simple, preserves the slug, but loses history of past occurrences.

**D. Plug-in automation**: a recurring-action plug-in that
auto-creates the next occurrence when the current one completes.
The plug-in would:

1. Watch for `done` transitions on actions tagged `++recurring`
   (or with a `++every:week` structured tag).
2. Create a new action with an updated deadline.
3. Optionally link it as a prerequisite of a tracking action.

This keeps the core model clean and pushes scheduling logic into
an extension point.

### Recommendation

No built-in recurring action support for now. Approach C
(edit-and-roll-forward) is a workable manual pattern. Approach D
(plug-in) is the right long-term solution — it needs the plug-in
system from section 4, which is future work.

Document approach C as an idiomatic pattern in user-facing docs
when recurring needs arise.

## 7. Implementation Order

Suggested sequence, each step independently useful:

1. **Extended tag pattern** — widen `\+\+(\w+)` to support `:`,
   `-`, `.` in tag names. Enables date tags and key-value tags.
   Small, low-risk change to `src/domain/tags.ts`.

2. **Tracking actions** — add `tracking` field to `Action`,
   computed state derivation, block manual transitions on tracking
   actions. Core domain change.

3. **`track` / `untrack` commands** — CLI commands to toggle
   tracking on existing actions.

4. **`split` command** — creates children and sets parent to
   tracking. Convenience built on top of steps 2–3.

5. **`move` command** — re-parent a sub-action. Convenience
   built on `unreq` + `req`.

6. **Blocked-action rendering** — visual indicators in `list`
   for actions with incomplete prerequisites. Rendering change
   only, no model change. Best combined with the indented
   sequential rendering from the README roadmap.

## Open Questions

- **Tag pattern**: is `\+\+([\w][\w:.\-]*)` the right pattern?
  Should we allow more characters? Fewer? What about spaces in
  values (probably not — tags are whitespace-delimited in titles)?
- **Start dates**: deferred, see section 3.
- **Overdue display**: deferred. When implemented, `list` could
  show a visual indicator for actions with a deadline tag in the
  past.
- **Slug-as-tag references**: `++slug` to reference any action.
  Interesting but deferred — namespace collision with tag names
  needs resolution. See section 3.
- **Untracking with stale state**: when `untrack` reverts a
  tracking action to manual, it gets the last computed state.
  Is this always the right choice?
- **Move ambiguity**: when a child has multiple parents, `move`
  errors. Should there be a `--from` flag, or is explicit
  `unreq`/`req` sufficient for that case?
- **Plug-in system**: needed for external tracking, recurring
  actions, and date-based auto-resolution. Design deferred.
- **Helper command naming**: the natural split between short
  primitives (`do`, `go`, `req`) and longer helpers (`split`,
  `move`, `track`) may be sufficient. Revisit if the CLI grows.
