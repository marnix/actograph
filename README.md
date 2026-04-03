# Actograph

[![CI](https://github.com/marnix/actograph/actions/workflows/ci.yml/badge.svg)](https://github.com/marnix/actograph/actions/workflows/ci.yml)

A local-first action management CLI built with [Automerge](https://automerge.org/) and TypeScript.

**Status:** Very early stage development. May never progress beyond experimentation.

**Platform:** Currently only developed and tested on Linux.

## Concept

Actograph is focused on managing **actions** (not generic tasks) with these core features:

- **Action-oriented**: Every item is something that must be done
- **Dependencies**: Actions can depend on other actions, providing helpful ordering
- **Decomposition**: Actions can be broken down into sub-actions
- **Local-first**: Data stored locally using Automerge CRDTs, with multi-device sync planned

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
- Add file locking for concurrent access (see known-failing concurrent test)
- Multi-device sync via per-device Automerge files + merge

## Future Plans

- Web app interface for browser-based access
- Multi-user/team collaboration features

## License

This is free and unencumbered software released into the public domain. See LICENSE file for details.

---

Note: Much of this codebase is LLM-generated.
