// Action domain entity - plain TypeScript, no framework dependency

export interface Action {
  id: string;
  title: string;
  completed: boolean;
}
