# Actograph

[![CI](https://github.com/marnix/actograph/actions/workflows/ci.yml/badge.svg)](https://github.com/marnix/actograph/actions/workflows/ci.yml)

A local-first action management CLI built with [Automerge](https://automerge.org/) and TypeScript.

**Status:** Very early stage development. May never progress beyond experimentation.

**Platform:** Currently only developed and tested on Linux.

## Concept

Actograph is focused on managing **actions** (not generic tasks) with these core features:

- **Action-oriented**: Every item is a command — something that must be done — with a minimal set of states (Open, Active, Done, Skipped)
- **Identity**: Every action has a unique human-friendly identifier (more memorable/typeable than a sequential number or GUID, and stable across edits). The exact format is still to be determined
- **Dependencies**: Actions can depend on other actions ("A is necessary for B"), providing a computed work order. The "necessary for" dependency also comes in an *owning* variant, where the parent action owns and is defined by its sub-actions
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

## TODO

- Choose appropriate default database location for all platforms (Linux, macOS, Windows)
- Make WSL2 use the Windows location for seamless cross-environment access
- Multi-device sync via per-device Automerge files + merge

## Future Plans

- Web app interface for browser-based access
- Multi-user/team collaboration features

## License

This is free and unencumbered software released into the public domain. See LICENSE file for details.

---

Note: Much of this codebase is LLM-generated.
