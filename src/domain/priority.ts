// Priority relationship - stored separately from actions

export interface Priority {
  higher: string; // action UUID
  lower: string; // action UUID
  createdAt: number; // milliseconds since epoch
}
