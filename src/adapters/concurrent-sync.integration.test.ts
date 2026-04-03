import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { startSyncServer } from "jazz-run/startSyncServer";
import { createWorkerAccount } from "jazz-run/createWorkerAccount";
import { startWorker } from "jazz-nodejs";
import { co, z } from "jazz-tools";
import type { Server } from "http";
import Database from "better-sqlite3";

// Define Action schema
const Action = co.map({
  title: z.string(),
  completed: z.boolean(),
});

// Define Account with actions list
const TestAccount = co.account({
  root: co.map({
    actions: co.list(Action),
  }),
  profile: co.profile(),
}).withMigration((account) => {
  if (!account.root) {
    account.root = co.map({ actions: co.list(Action) }).create({
      actions: co.list(Action).create([]),
    });
  }
});

describe("Concurrent Sync Servers with SQLite WAL", () => {
  let testDir: string;
  let dbPath: string;
  let servers: Server[] = [];

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "actograph-test-"));
    dbPath = join(testDir, "jazz-sync.db");
  });

  afterEach(() => {
    servers.forEach((server) => server.close());
    servers = [];
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should create 10 actions from same account through 10 parallel sync servers", async () => {
    // Start 10 sync servers
    const serverPromises = Array.from({ length: 10 }, async (_, i) => {
      const port = 5000 + i;
      const server = await startSyncServer({
        host: "127.0.0.1",
        port: port.toString(),
        inMemory: false,
        db: dbPath,
      });
      servers.push(server);
      return { server, port };
    });

    const startedServers = await Promise.all(serverPromises);
    console.log(`✓ Started 10 sync servers`);

    // Create ONE account (simulating one user)
    const { accountID, agentSecret } = await createWorkerAccount({
      name: "Single User",
      peer: `ws://localhost:${startedServers[0].port}`,
    });

    console.log(`✓ Created account: ${accountID}`);

    // Connect 10 workers with the SAME account, each to a different server
    // This simulates the same user on 10 different devices
    const workerPromises = startedServers.map(async ({ port }, i) => {
      const syncUrl = `ws://localhost:${port}`;
      
      const { worker, done } = await startWorker({
        accountID,
        accountSecret: agentSecret,
        syncServer: syncUrl,
        AccountSchema: TestAccount,
      });

      // Each "device" creates one action
      const action = Action.create(
        {
          title: `Action from device ${i}`,
          completed: false,
        },
        { owner: worker }
      );

      // Add to the shared actions list
      worker.root.actions.push(action);

      await done();
      return action.id;
    });

    const actionIds = await Promise.all(workerPromises);
    expect(actionIds).toHaveLength(10);
    console.log(`✓ Created 10 actions from same account via 10 sync servers`);

    // Wait for data to sync and flush
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Close all servers
    servers.forEach((server) => server.close());
    servers = [];
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify database
    expect(existsSync(dbPath)).toBe(true);
    const dbSize = statSync(dbPath).size;
    console.log(`✓ Database size: ${dbSize} bytes`);
    expect(dbSize).toBeGreaterThanOrEqual(4096);

    const db = new Database(dbPath, { readonly: true });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    
    const dataTable = tables.find((t) => !t.name.startsWith("sqlite_"));
    if (dataTable) {
      const rowCount = db
        .prepare(`SELECT COUNT(*) as count FROM ${dataTable.name}`)
        .get() as { count: number };
      console.log(`✓ Database has ${rowCount.count} rows`);
    }
    db.close();

    console.log(`✓ Database size: ${dbSize} bytes`);

    // Start a fresh 11th sync server
    const verifyServer = await startSyncServer({
      host: "127.0.0.1",
      port: "6000",
      inMemory: false,
      db: dbPath,
    });

    // Connect with the SAME account to the fresh server
    const { worker: verifier, done: verifierDone } = await startWorker({
      accountID,
      accountSecret: agentSecret,
      syncServer: "ws://localhost:6000",
      AccountSchema: TestAccount,
    });

    // Wait a moment for sync
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify we can see all 10 actions
    const actionCount = verifier.root.actions.length;
    console.log(`✓ Fresh sync server loaded account with ${actionCount} actions`);
    expect(actionCount).toBe(10);

    await verifierDone();
    verifyServer.close();
  }, 60000);
});