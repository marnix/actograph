// Action domain entity - plain TypeScript, no framework dependency

export interface Prerequisite {
  actionId: string;
  createdAt: number; // milliseconds since epoch
}

export interface Action {
  id: string;
  title: string;
  completed: boolean;
  prerequisites: Prerequisite[];
}
