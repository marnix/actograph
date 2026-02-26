import { CoMap, co } from "jazz-tools";

// Action schema
export class Action extends CoMap {
  title = co.string;
  completed = co.boolean;
}

console.log("Actograph initialized");
