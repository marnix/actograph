// Port interface for storage operations
import type { Action } from "../domain/action.js";
import type { Priority } from "../domain/priority.js";

export interface StoragePort {
  /** Load all actions from storage. May run migrations. */
  load(): Action[];

  /** Load all priority relations from storage. */
  loadPriorities(): Priority[];

  /** Load actions and priorities from a single doc parse.
   *  Optional migrate callback mutates actions in-place; return true if changes were made. */
  loadAll(migrate?: (actions: Action[]) => boolean): {
    actions: Action[];
    priorities: Priority[];
    migrationNeeded: boolean;
  };

  /** Run a load→modify→save cycle under a single lock. */
  transact(
    fn: (data: { actions: Action[]; priorities: Priority[] }) => {
      actions: Action[];
      priorities: Priority[];
    },
  ): void;

  /** Release any resources held by this adapter. */
  close(): void;
}
