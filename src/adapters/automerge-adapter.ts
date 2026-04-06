// Automerge storage adapter
// Stores actions in an Automerge document, persisted as a single file.
// Multi-device sync (per-device files + merge) is planned for later.
//
// Actions are stored as a map keyed by ID, so that concurrent edits
// to different actions merge cleanly at the field level.
//
// Concurrency: uses a hard-link lock file (VSDB-inspired) for mutual
// exclusion. fs.linkSync is atomic and fails with EEXIST on both Linux
// and Windows, giving us a cross-platform mutex without advisory
// locking or platform-specific APIs.
//
// The lock is held for the entire load→modify→save transaction via
// the `transact` method, ensuring no concurrent writer can interleave.

import * as Automerge from "@automerge/automerge";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  linkSync,
  unlinkSync,
} from "fs";
import { randomUUID } from "crypto";
import type { Action, Prerequisite } from "../domain/action.js";
import type { Priority } from "../domain/priority.js";
import type { StoragePort } from "../ports/storage-port.js";

type PrerequisiteRecord = { actionId: string; createdAt: number };
type ActionRecord = {
  title: string;
  completed: boolean;
  prerequisites: PrerequisiteRecord[];
};
type PriorityRecord = { higher: string; lower: string; createdAt: number };
type DocSchema = {
  actions: Record<string, ActionRecord>;
  priorities: PriorityRecord[];
};

const LOCK_SUFFIX = ".lock";
const LOCK_TIMEOUT_MS = 30_000;

const sleepBuf = new SharedArrayBuffer(4);
const sleepArr = new Int32Array(sleepBuf);

function sleep(ms: number): void {
  Atomics.wait(sleepArr, 0, 0, ms);
}

function acquireLock(filePath: string): {
  lockPath: string;
  contended: boolean;
} {
  const lockPath = filePath + LOCK_SUFFIX;
  const tmpPath = filePath + `.__${randomUUID()}.tmp`;
  writeFileSync(tmpPath, "");
  let contended = false;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      linkSync(tmpPath, lockPath);
      unlinkSync(tmpPath);
      return { lockPath, contended };
    } catch (e: any) {
      if (e.code !== "EEXIST") {
        unlinkSync(tmpPath);
        throw e;
      }
      contended = true;
      sleep(1 + Math.floor(Math.random() * 10));
    }
  }
  unlinkSync(tmpPath);
  throw new Error(`Failed to acquire lock within ${LOCK_TIMEOUT_MS}ms`);
}

function releaseLock(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch {
    // already removed
  }
}

function loadDoc(filePath: string): Automerge.Doc<DocSchema> {
  return existsSync(filePath)
    ? Automerge.load<DocSchema>(readFileSync(filePath))
    : Automerge.from<DocSchema>({ actions: {}, priorities: [] });
}

function docToActions(doc: Automerge.Doc<DocSchema>): Action[] {
  return Object.entries(doc.actions).map(([id, a]) => ({
    id,
    title: a.title,
    completed: a.completed,
    prerequisites: (a.prerequisites ?? []).map((p) => ({
      actionId: p.actionId,
      createdAt: p.createdAt,
    })),
  }));
}

function applyActions(
  doc: Automerge.Doc<DocSchema>,
  actions: Action[],
): Automerge.Doc<DocSchema> {
  return Automerge.change(doc, (d) => {
    const newIds = new Set(actions.map((a) => a.id));
    for (const id of Object.keys(d.actions)) {
      if (!newIds.has(id)) delete d.actions[id];
    }
    for (const a of actions) {
      if (!d.actions[a.id]) {
        d.actions[a.id] = {
          title: a.title,
          completed: a.completed,
          prerequisites: (a.prerequisites ?? []).map((p) => ({
            actionId: p.actionId,
            createdAt: p.createdAt,
          })),
        };
      } else {
        const existing = d.actions[a.id];
        if (existing) {
          existing.title = a.title;
          existing.completed = a.completed;
          existing.prerequisites = (a.prerequisites ?? []).map((p) => ({
            actionId: p.actionId,
            createdAt: p.createdAt,
          }));
        }
      }
    }
  });
}

export class AutomergeAdapter implements StoragePort {
  private filePath: string;
  contentionCount = 0;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  load(): Action[] {
    return docToActions(loadDoc(this.filePath));
  }

  save(actions: Action[]): void {
    const { lockPath, contended } = acquireLock(this.filePath);
    if (contended) this.contentionCount++;
    try {
      const doc = loadDoc(this.filePath);
      const updated = applyActions(doc, actions);
      writeFileSync(this.filePath, Automerge.save(updated));
    } finally {
      releaseLock(lockPath);
    }
  }

  /** Run a load→modify→save cycle under a single lock. */
  transact(fn: (actions: Action[]) => Action[]): void {
    const { lockPath, contended } = acquireLock(this.filePath);
    if (contended) this.contentionCount++;
    try {
      const doc = loadDoc(this.filePath);
      const actions = fn(docToActions(doc));
      const updated = applyActions(doc, actions);
      writeFileSync(this.filePath, Automerge.save(updated));
    } finally {
      releaseLock(lockPath);
    }
  }

  loadPriorities(): Priority[] {
    const doc = loadDoc(this.filePath);
    return (doc.priorities ?? []).map((p) => ({
      higher: p.higher,
      lower: p.lower,
      createdAt: p.createdAt,
    }));
  }

  savePriorities(priorities: Priority[]): void {
    const { lockPath, contended } = acquireLock(this.filePath);
    if (contended) this.contentionCount++;
    try {
      const doc = loadDoc(this.filePath);
      const updated = Automerge.change(doc, (d) => {
        if (!d.priorities) d.priorities = [];
        while (d.priorities.length > 0) d.priorities.splice(0, 1);
        for (const p of priorities) {
          d.priorities.push({
            higher: p.higher,
            lower: p.lower,
            createdAt: p.createdAt,
          });
        }
      });
      writeFileSync(this.filePath, Automerge.save(updated));
    } finally {
      releaseLock(lockPath);
    }
  }

  close(): void {
    // No resources to release
  }
}
