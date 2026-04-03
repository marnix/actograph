// Automerge storage adapter
// Stores actions in an Automerge document, persisted as a single file.
// Multi-device sync (per-device files + merge) is planned for later.
//
// Actions are stored as a map keyed by ID, so that concurrent edits
// to different actions merge cleanly at the field level.

import * as Automerge from "@automerge/automerge";
import { readFileSync, writeFileSync, existsSync } from "fs";
import type { Action } from "../domain/action.js";
import type { StoragePort } from "../ports/storage-port.js";

type ActionRecord = { title: string; completed: boolean };
type DocSchema = { actions: Record<string, ActionRecord> };

export class AutomergeAdapter implements StoragePort {
  private doc: Automerge.Doc<DocSchema>;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.doc = existsSync(filePath)
      ? Automerge.load<DocSchema>(readFileSync(filePath))
      : Automerge.from<DocSchema>({ actions: {} });
  }

  load(): Action[] {
    return Object.entries(this.doc.actions).map(([id, a]) => ({
      id,
      title: a.title,
      completed: a.completed,
    }));
  }

  save(actions: Action[]): void {
    this.doc = Automerge.change(this.doc, (d) => {
      // Remove deleted actions
      const newIds = new Set(actions.map((a) => a.id));
      for (const id of Object.keys(d.actions)) {
        if (!newIds.has(id)) delete d.actions[id];
      }
      // Upsert actions
      for (const a of actions) {
        if (!d.actions[a.id]) {
          d.actions[a.id] = { title: a.title, completed: a.completed };
        } else {
          d.actions[a.id].title = a.title;
          d.actions[a.id].completed = a.completed;
        }
      }
    });
    writeFileSync(this.filePath, Automerge.save(this.doc));
  }

  close(): void {
    // No resources to release
  }
}
