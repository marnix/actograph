// Priority relationship - stored separately from actions

export interface Priority {
  higher: string; // action ID
  lower: string; // action ID
  createdAt: number; // milliseconds since epoch
}
