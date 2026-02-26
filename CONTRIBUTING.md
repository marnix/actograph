# Contributing to Actograph

## Project Structure

```
actograph/
├── src/
│   ├── index.ts          # CLI entry point with Commander setup
│   ├── storage.ts        # SQLite database configuration
│   └── *.test.ts         # Unit tests (co-located with source)
├── dist/                 # Compiled JavaScript output
├── actograph             # Wrapper script for running CLI
└── dev-local/            # Local development notes (not tracked)
```

## Development Setup

1. Install Node.js 24.x (use nvm: `nvm use`)
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run: `./actograph`

## Quick Commands

- `npm run run` - Build and run CLI (incremental build)
- `npm run dev` - Watch mode for development
- `npm test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run typecheck` - Type check without building
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

## Testing Conventions

- Tests are co-located with source files (`.test.ts`)
- Use Vitest for testing
- Tests use temporary directories for database operations
- Always clean up resources in `afterEach`

## Technology Choices

### Jazz (jazz-tools)
- Distributed database for local-first sync
- Handles data synchronization across devices
- Uses CRDTs for conflict-free merging

### SQLite (better-sqlite3)
- Local storage backend
- WAL mode for concurrent access
- 5-second timeout for automatic retry on locks

### Commander
- CLI argument parsing
- Supports subcommands and global options
- Built-in help generation

### Vitest
- Fast test runner with TypeScript support
- Compatible with future Vue web app
- ESM-first design matches project setup

## Build Process

TypeScript compilation uses incremental builds:
- `.tsbuildinfo` tracks what needs recompilation
- `tsc --build` only rebuilds changed files
- Much faster for iterative development

## Database Location

- Linux: `~/.local/share/actograph/` (XDG spec)
- Configurable via `XDG_DATA_HOME` environment variable
- TODO: Windows and macOS paths, WSL2 integration
