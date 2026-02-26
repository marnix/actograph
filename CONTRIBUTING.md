# Contributing to Actograph

## Project Structure

```
actograph/
├── src/
│   ├── index.ts          # CLI entry point with Commander setup
│   ├── storage.ts        # SQLite database configuration
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

### Jazz's Role

Jazz is the entire sync/storage layer, not just a library:

- Define schemas using `co.map()`, `co.list()`, etc.
- Jazz CoValues are automatically persisted and synced
- No traditional CRUD code needed
- Data syncs automatically across devices when online

### Storage Layer

- SQLite with WAL mode for concurrent access
- 5-second timeout for automatic retry on locks
- XDG directories on Linux (`~/.local/share/actograph/`)
- Configurable via `XDG_DATA_HOME` environment variable
- TODO: Windows and macOS paths, WSL2 integration

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
- Run `npm run check` before committing (runs typecheck, format check, and tests)

## Technology Stack

- **Jazz (jazz-tools)** - Distributed database with CRDT-based sync
- **SQLite (better-sqlite3)** - Local storage with WAL mode
- **Commander** - CLI argument parsing with subcommands
- **Vitest** - Fast test runner, compatible with future Vue web app
- **TypeScript** - ES2023 target with incremental compilation
