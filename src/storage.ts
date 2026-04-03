// storage.ts - Storage utilities
// Uses XDG directories on Linux

import { homedir } from "os";
import { join } from "path";
import { mkdirSync } from "fs";

/**
 * Get the data directory for storing application data.
 * Uses XDG Base Directory specification on Linux for better integration.
 * Falls back to ~/.local/share/actograph if XDG_DATA_HOME is not set.
 *
 * TODO: Add Windows/macOS path support (see README TODO section)
 */
export function getDataDir(): string {
  const home = homedir();
  const dataDir = process.env.XDG_DATA_HOME
    ? join(process.env.XDG_DATA_HOME, "actograph")
    : join(home, ".local", "share", "actograph");

  mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

export function getDbPath(): string {
  return join(getDataDir(), "actograph.automerge");
}
