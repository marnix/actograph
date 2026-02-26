import { Command } from "commander";
import { CoMap, co } from "jazz-tools";
import { openDatabase } from "./storage.js";

// Action schema
export class Action extends CoMap {
  title = co.string;
  completed = co.boolean;
}

const program = new Command();

program
  .name("actograph")
  .description("Local-first action management CLI")
  .version("0.1.0");

program.parse();

const db = openDatabase();
console.log("Actograph initialized");
console.log("Database:", db.name);
db.close();
