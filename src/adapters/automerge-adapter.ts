// Automerge storage adapter
// Stores actions in an Automerge document, persisted as a single file.
// Multi-device sync (per-device files + merge) is planned for later.
//
// Actions are stored as a map keyed by UUID, so that concurrent edits
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
import type { Action, ActionState } from "../domain/action.js";
import type { Priority } from "../domain/priority.js";
import type { StoragePort } from "../ports/storage-port.js";

type PrerequisiteRecord = { actionId: string; createdAt: number };
type ActionRecord = {
  slug?: string;
  title: string;
  state: string;
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

const VALID_STATES: ReadonlySet<string> = new Set<ActionState>([
  "open",
  "active",
  "done",
  "skipped",
]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

function parseState(key: string, record: ActionRecord): ActionState {
  const raw = record as Record<string, unknown>;
  if (typeof record.state === "string" && VALID_STATES.has(record.state)) {
    return record.state as ActionState;
  }
  if (raw["completed"]) return "done";
  if (typeof record.state === "string") {
    console.error(
      `Warning: action ${key} has unknown state "${record.state}", defaulting to "open"`,
    );
  }
  return "open";
}

function assertUniqueSlugs(actions: Action[]): void {
  const seen = new Map<string, string>();
  for (const a of actions) {
    const prev = seen.get(a.slug);
    if (prev) {
      throw new Error(
        `Duplicate slug "${a.slug}" on actions ${prev} and ${a.uuid}`,
      );
    }
    seen.set(a.slug, a.uuid);
  }
}

/**
 * Convert doc to Action[]. Handles migration from old format where
 * map keys were CVCVCVC slugs to new format where keys are UUIDs.
 */
function docToActions(doc: Automerge.Doc<DocSchema>): {
  actions: Action[];
  migrated: boolean;
} {
  const entries = Object.entries(doc.actions);
  // Detect old format: keys are not UUIDs
  const needsMigration =
    entries.length > 0 && entries.some(([k]) => !isUuid(k));

  if (!needsMigration) {
    // New format: key is UUID, slug is stored in record
    const actions = entries.map(([uuid, a]) => ({
      uuid,
      slug: a.slug ?? uuid.slice(0, 7),
      title: a.title,
      state: parseState(uuid, a),
      prerequisites: (a.prerequisites ?? []).map((p) => ({
        uuid: p.actionId,
        createdAt: p.createdAt,
      })),
    }));
    assertUniqueSlugs(actions);
    return { actions, migrated: false };
  }

  // Old format: key is CVCVCVC slug, no UUID stored
  // Build old-key → new-uuid mapping
  const keyToUuid = new Map<string, string>();
  for (const [key] of entries) {
    keyToUuid.set(key, isUuid(key) ? key : randomUUID());
  }

  const actions = entries.map(([key, a]) => ({
    uuid: keyToUuid.get(key)!,
    slug: isUuid(key) ? (a.slug ?? key.slice(0, 7)) : key,
    title: a.title,
    state: parseState(key, a),
    prerequisites: (a.prerequisites ?? []).map((p) => ({
      uuid: keyToUuid.get(p.actionId) ?? p.actionId,
      createdAt: p.createdAt,
    })),
  }));

  assertUniqueSlugs(actions);
  return { actions, migrated: true };
}

function migratePriorities(
  priorities: PriorityRecord[],
  keyToUuid: Map<string, string>,
): Priority[] {
  return (priorities ?? []).map((p) => ({
    higher: keyToUuid.get(p.higher) ?? p.higher,
    lower: keyToUuid.get(p.lower) ?? p.lower,
    createdAt: p.createdAt,
  }));
}

function applyActions(
  doc: Automerge.Doc<DocSchema>,
  actions: Action[],
): Automerge.Doc<DocSchema> {
  return Automerge.change(doc, (d) => {
    const newUuids = new Set(actions.map((a) => a.uuid));
    for (const key of Object.keys(d.actions)) {
      if (!newUuids.has(key)) delete d.actions[key];
    }
    for (const a of actions) {
      if (!d.actions[a.uuid]) {
        d.actions[a.uuid] = {
          slug: a.slug,
          title: a.title,
          state: a.state,
          prerequisites: (a.prerequisites ?? []).map((p) => ({
            actionId: p.uuid,
            createdAt: p.createdAt,
          })),
        };
      } else {
        const existing = d.actions[a.uuid];
        if (existing) {
          existing.slug = a.slug;
          existing.title = a.title;
          existing.state = a.state;
          existing.prerequisites = (a.prerequisites ?? []).map((p) => ({
            actionId: p.uuid,
            createdAt: p.createdAt,
          }));
        }
      }
    }
  });
}

function docToPriorities(doc: Automerge.Doc<DocSchema>): Priority[] {
  return (doc.priorities ?? []).map((p) => ({
    higher: p.higher,
    lower: p.lower,
    createdAt: p.createdAt,
  }));
}

function applyPriorities(
  doc: Automerge.Doc<DocSchema>,
  priorities: Priority[],
): Automerge.Doc<DocSchema> {
  return Automerge.change(doc, (d) => {
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
}

export class AutomergeAdapter implements StoragePort {
  private filePath: string;
  contentionCount = 0;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  load(): Action[] {
    const doc = loadDoc(this.filePath);
    const { actions, migrated } = docToActions(doc);
    if (migrated) {
      // Persist migration
      let updated = applyActions(doc, actions);
      const oldKeys = new Map(
        Object.keys(doc.actions).map((k) => [
          k,
          actions.find((a) => a.slug === k || (isUuid(k) && a.uuid === k))
            ?.uuid ?? k,
        ]),
      );
      updated = applyPriorities(
        updated,
        migratePriorities(doc.priorities ?? [], oldKeys),
      );
      writeFileSync(this.filePath, Automerge.save(updated));
    }
    return actions;
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
  transact(
    fn: (data: { actions: Action[]; priorities: Priority[] }) => {
      actions: Action[];
      priorities: Priority[];
    },
  ): void {
    const { lockPath, contended } = acquireLock(this.filePath);
    if (contended) this.contentionCount++;
    try {
      const doc = loadDoc(this.filePath);
      const { actions } = docToActions(doc);
      const priorities = docToPriorities(doc);
      const result = fn({ actions, priorities });
      let updated = applyActions(doc, result.actions);
      updated = applyPriorities(updated, result.priorities);
      writeFileSync(this.filePath, Automerge.save(updated));
    } finally {
      releaseLock(lockPath);
    }
  }

  loadPriorities(): Priority[] {
    return docToPriorities(loadDoc(this.filePath));
  }

  savePriorities(priorities: Priority[]): void {
    const { lockPath, contended } = acquireLock(this.filePath);
    if (contended) this.contentionCount++;
    try {
      const doc = loadDoc(this.filePath);
      const updated = applyPriorities(doc, priorities);
      writeFileSync(this.filePath, Automerge.save(updated));
    } finally {
      releaseLock(lockPath);
    }
  }

  close(): void {
    // No resources to release
  }
}
