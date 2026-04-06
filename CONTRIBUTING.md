# Contributing to Actograph

## Project Structure

```
actograph/
├── src/
│   ├── index.ts          # CLI entry point with Commander setup
│   ├── storage.ts        # Database path configuration
│   ├── domain/
│   │   └── action.ts     # Action domain entity
│   ├── ports/
│   │   └── storage-port.ts  # Storage port interface
│   ├── adapters/
│   │   └── automerge-adapter.ts  # Automerge storage implementation
│   └── *.test.ts         # Unit tests (co-located with source)
├── dist/                 # Compiled JavaScript output
├── acto                  # Wrapper script for running CLI
└── dev-local/            # Local development notes (not tracked)
```

## Development Setup

1. Install Node.js 24.x (use nvm: `nvm use`)
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run: `./acto`

## Quick Commands

- `npm run acto` - Build and run CLI (incremental build)
- `npm run dev` - Watch mode for development
- `npm test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run typecheck` - Type check without building
- `npm run format` - Format all files with Prettier
- `npm run format:check` - Check formatting without changing files
- `npm run check` - Run all checks (typecheck + format + test)
- `npm run ci` - Full CI validation (check + build)
- `npm run clean` - Remove build artifacts

## Adding New Commands

Commands are defined in `src/index.ts` using Commander:

```typescript
program
  .command("add <action>")
  .description("Add a new action")
  .action((action) => {
    // Implementation
  });
```

## Architecture

### Storage Layer

- **Automerge CRDT** for local-first storage with future merge support
- Actions stored as a map keyed by ID (7-character CVCVCVC syllable strings) in an Automerge document
- Persisted as a single binary file (`.automerge`)
- Concurrent access protected by VSDB-inspired hard-link locking
  (`fs.linkSync` as atomic mutex, works on both Linux and Windows/NTFS)
- `transact()` method holds the lock for the entire load→modify→save cycle
- XDG directories on Linux (`~/.local/share/actograph/`)
- Configurable via `XDG_DATA_HOME` environment variable
- TODO: Windows and macOS paths, WSL2 integration
- TODO: Multi-device sync via per-device files + Automerge merge

### Ports & Adapters

- `StoragePort` interface decouples domain from storage implementation
- `AutomergeAdapter` implements the port using Automerge

## Code Style

- Use Prettier with default settings for all formatting
- Run `npm run format` before committing
- Inline comments explain "why", not "what"
- Add TODO comments for deferred decisions
- Co-locate tests with source files (`.test.ts`)
- Use incremental builds (`tsc --build`)

## Testing

- Use Vitest for all tests
- Tests use temporary directories for database operations
- Always clean up resources in `afterEach` hooks
- Concurrent test uses child processes for real parallelism, retries until
  actual lock contention is verified (at least 5 contentions observed)
- Run `npm run check` before committing (runs typecheck, format check, and tests)
- Run `npm run ci` to simulate CI locally (check + build)

## Technology Stack

- **Automerge (@automerge/automerge)** - CRDT-based local-first storage
- **Commander** - CLI argument parsing with subcommands
- **Vitest** - Fast test runner, compatible with future Vue web app
- **TypeScript** - ES2023 target with incremental compilation
