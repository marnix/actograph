# Actograph

A local-first action management CLI built with [Jazz](https://jazz.tools/) and TypeScript.

**Status:** Very early stage development. May never progress beyond experimentation.

**Platform:** Currently only developed and tested on Linux.

## Concept

Actograph is focused on managing **actions** (not generic tasks) with these core features:

- **Action-oriented**: Every item is something that must be done
- **Dependencies**: Actions can depend on other actions, providing helpful ordering
- **Decomposition**: Actions can be broken down into sub-actions
- **Local-first**: Data syncs across devices using Jazz's distributed database

## Technology

- **[Jazz](https://jazz.tools/)**: Distributed database for local-first sync and storage
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
./actograph --help
```

For development with auto-rebuild:

```bash
npm run dev
```

## Resources

- [Jazz Documentation](https://jazz.tools/docs/vanilla)
- [Jazz Installation Guide](https://jazz.tools/docs/vanilla/project-setup)
- [Jazz GitHub](https://github.com/garden-co/jazz)

## TODO

- Choose appropriate default database location for all platforms (Linux, macOS, Windows)
- Make WSL2 use the Windows location for seamless cross-environment access

## Future Plans

- Web app interface for browser-based access
- Multi-user/team collaboration features

## License

This is free and unencumbered software released into the public domain. See LICENSE file for details.

---

Note: Much of this codebase is LLM-generated.
