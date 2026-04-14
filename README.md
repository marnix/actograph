# Actograph

[![CI](https://github.com/marnix/actograph/actions/workflows/ci.yml/badge.svg)](https://github.com/marnix/actograph/actions/workflows/ci.yml)

A local-first action management CLI built with [Automerge](https://automerge.org/) and TypeScript.

**Status:** Very early stage development. May never progress beyond experimentation.

**Platform:** Currently only developed and tested on Linux.

## Concept

Actograph is focused on managing **actions** (not generic tasks) with these core features:

- **Action-oriented**: Every item is a command — something that must be done — with four states: Open `[ ]`, Active `[▶]`, Done `[✓]`, Skipped `[–]`
- **Identity**: Every action has a unique human-friendly identifier — a pronounceable 7-character consonant-vowel string (e.g., `takapup`, `zebepod`), stable across edits, with prefix matching for quick reference. See [design/action-naming.md](design/action-naming.md)
- **Dependencies**: Actions can depend on other actions ("A is necessary for B"), providing a computed work order. The "necessary for" dependency also comes in an _owning_ variant, where the parent action owns and is defined by its sub-actions
- **Priority**: A separate "more important than" relation combines with dependencies to determine overall work order
- **Task groups**: Actions can be grouped for triaging (priority, project, version), with group-level dependencies inherited by members. Tag actions (whose title is only `++tagname`) are immutable: they cannot change state or be edited
- **Local-first**: Data stored locally using Automerge CRDTs, with multi-device sync planned

See [design/task-list-application.md](design/task-list-application.md) for the original design exploration document with more detailed concepts and ideas.

## Technology

- **[Automerge](https://automerge.org/)**: CRDT-based storage for local-first data
- **TypeScript**: Type-safe development
- **CLI**: Terminal-based interface

## Build Instructions

Prerequisites: Node.js 24.x or later

```bash
npm install
npm run build
```

To run the CLI:

```bash
./acto --help
```

For development with auto-rebuild:

```bash
npm run dev
```

## Resources

- [Automerge Documentation](https://automerge.org/docs/)
- [Automerge GitHub](https://github.com/automerge/automerge)

## Design Documents

- [Task List Application](design/task-list-application.md) — Original design exploration: concepts, states, dependencies, work order, task groups
- [Action Naming](design/action-naming.md) — CVCVCVC syllable IDs with profanity filtering
- [CLI Commands](design/cli-commands.md) — Command vocabulary, tags, and listing options
- [Dependencies](design/dependencies.md) — Prerequisites, priorities, and tag inheritance

## Roadmap / Ideas

Roughly in order, but not set in stone:

- **Auto-add tags** — Adding an action with an unknown `++tag` automatically creates the tag action. A one-time migration adds tag actions retroactively for all existing tags that lack one
- **Show slug on create** — `acto do` prints the slug of the newly created action, so it can immediately be used with e.g. `acto go`
- **Interactive do** — `acto do` with no arguments interactively creates a new action (similar to `acto edit`'s interactive mode)
- **List by tag** — `acto list ++sometag` lists all actions carrying that tag, including their internal dependencies. Supporting multiple tags (`acto list ++foo ++bar`) would be nice, but open question: show actions with _both_ tags (intersection) or _either_ tag (union)?
- **Tag usage in list** — `acto list --tags` shows which tags are unused; sort tags by usage count (most-used first)
- **Action management commands** — Commands and conventions for common workflows: splitting an action into sub-actions, replacing an action with a refined version, and deadline/milestone actions (e.g., a release cut-off date that other actions must precede). Explore whether deadlines are best modeled as tag actions, regular actions with `req` edges, or something new. Include guidance on idiomatic patterns for these workflows
- **Show single action** — `acto show <slug>` to inspect one action's full state, prerequisites, and priority relations
- **Indented sequential rendering** — Improve `list` readability by indenting sequential chains: either indent all but the first `>>` level, or add one space of indent per action depth. Explore which feels more natural for nested series-parallel structures
- **Multi-device sync** — Add a `merge` command that loads a second `.automerge` file and merges it into the local one. Must handle duplicate slugs and duplicate tag actions that can arise from independent creation on different devices (currently detected and rejected at load time; merge should auto-resolve). Slug conflicts: both conflicting actions get new slugs, and a new skipped action is created as a prerequisite of both (so the user sees the conflict and can resolve it). Duplicate tag actions should be merged by renaming. Also needs to clean up dangling prerequisite/priority references to actions that were removed on another device (currently warned at load time but not auto-cleaned)
- **Cycle robustness after merge** — Handle cycles that appear via concurrent edits after multi-device merge (detect, warn, and gracefully degrade the work order rather than crash)
- **Cross-platform storage** — Appropriate default DB locations for macOS (`~/Library/Application Support`) and Windows (`%LOCALAPPDATA%`), including WSL2 using the Windows location
- **Terminal UI** — Interactive terminal interface (consider [Ink](https://github.com/vadimdemedes/ink) for React-based Node.js TUI)
- **Web UI** — Browser-based interface
- **Multi-user/team collaboration**

## Known Issues

- `slug` is optional in `ActionRecord` (automerge adapter) — investigate whether this can be made required to align with the domain `Action` type

## License

This is free and unencumbered software released into the public domain. See LICENSE file for details.

---

Note: Much of this codebase is LLM-generated.
