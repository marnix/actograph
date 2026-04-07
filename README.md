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
- **Task groups**: Actions can be grouped for triaging (priority, project, version), with group-level dependencies inherited by members
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
- [CLI Commands](design/cli-commands.md) — Command vocabulary design decisions
- [Dependencies](design/dependencies.md) — Prerequisites and priorities between actions

## Roadmap / Ideas

Roughly in order, but not set in stone:

1. ~~**Human-friendly action IDs** — Replace UUIDs with short memorable identifiers (stable across edits). Format TBD~~ ✅ Done: CVCVCVC syllable IDs with profanity filtering
2. ~~**Dependencies** — "A needs B": store and display which actions depend on which~~ ✅ Done: `acto req` command
3. ~~**"More important than" relation** — A separate priority ordering between actions~~ ✅ Done: `acto prio` command
4. ~~**Work order display** — Show actions as a series-parallel graph based on dependencies and priority~~ ✅ Done: `acto list` shows SP-structured output with `>>` and `||` markers
5. ~~**Action lifecycle** — Replace the boolean `completed` with states (Open, Active, Done, Skipped) and transitions~~ ✅ Done: 4-state model with `go`, `done`, `donot`, `skip`, `redo` commands
6. ~~**CLI/UX design** — Design a concise command vocabulary~~ ✅ Done: `do`, `done`, `go`, `donot`, `skip`, `redo`, `list`, `req`, `prio`, `unreq`, `unprio`
7. ~~**State transition validation** — Guard CLI state commands against invalid transitions (e.g., `go` only from Open, `donot` only from Active), matching the state machine in the design doc~~ ✅ Done: `canTransition` guard in domain layer, enforced by all state commands
8. ~~**Cycle prevention in CLI** — Call `wouldCreateCycle` from `req` and `prio` commands to reject cycle-introducing dependencies at input time~~ ✅ Done: both commands check against the full work order graph before persisting
9. ~~**Remove dependencies/priorities** — Add `unreq` and `unprio` commands to undo `req`/`prio` relations~~ ✅ Done: domain-level `removePrerequisite`/`removePriority` with CLI commands
10. ~~**Hide completed/skipped actions** — Filter Done and Skipped actions from `list` by default (as the design doc specifies), with a flag like `--all` to show everything~~ ✅ Done: `list` shows open/active only, `list -a` shows all
11. **Tags** — Any action description can include `++sometagname` inline. An action whose description is _only_ a tag name (e.g., `++urgent`) becomes a tag action; its dependencies are inherited by all actions that mention that tag. This implements the "task groups" concept from the design doc (triaging by priority, project, version) without a separate grouping mechanism
12. **Multi-device sync** — Add a `merge` command that loads a second `.automerge` file and merges it into the local one
13. **Cycle robustness after merge** — Handle cycles that appear via concurrent edits after multi-device merge (detect, warn, and gracefully degrade the work order rather than crash)
14. **Cross-platform storage** — Appropriate default DB locations for macOS (`~/Library/Application Support`) and Windows (`%LOCALAPPDATA%`), including WSL2 using the Windows location
15. **Terminal UI** — Interactive terminal interface (consider [Ink](https://github.com/vadimdemedes/ink) for React-based Node.js TUI)
16. **Web UI** — Browser-based interface
17. **Multi-user/team collaboration**

## License

This is free and unencumbered software released into the public domain. See LICENSE file for details.

---

Note: Much of this codebase is LLM-generated.
