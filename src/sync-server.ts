// Sync server management
import { startSyncServer } from "jazz-run/startSyncServer";
import { getDataDir } from "./storage.js";
import { join } from "path";
import type { Server } from "http";

let syncServer: Server | null = null;
const syncServerUrl = "ws://localhost:4200";
const syncServerPort = 4200;

/**
 * Start the sync server in-process
 */
export async function ensureSyncServer(): Promise<string> {
  if (syncServer) {
    return syncServerUrl;
  }

  console.log("Starting sync server...");
  
  const dbPath = join(getDataDir(), "jazz-sync.db");
  
  syncServer = await startSyncServer({
    host: "127.0.0.1",
    port: syncServerPort.toString(),
    inMemory: false,
    db: dbPath,
  });

  console.log(`Sync server started on port ${syncServerPort}`);
  return syncServerUrl;
}


