import { CoMap, co } from "jazz-tools";
import { openDatabase } from "./storage.js";

// Action schema
export class Action extends CoMap {
  title = co.string;
  completed = co.boolean;
}

const db = openDatabase();
console.log("Actograph initialized");
console.log("Database:", db.name);
db.close();
