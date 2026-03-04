// Action schema - domain entity
import { CoMap, co } from "jazz-tools";

export class Action extends CoMap {
  title = co.string;
  completed = co.boolean;
}
