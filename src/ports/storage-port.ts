// Port interface for storage operations
import type { Action } from "../domain/action.js";

export interface StoragePort {
  load(): Action[];
  save(actions: Action[]): void;
  close(): void;
}
