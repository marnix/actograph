import { describe, it, expect } from "vitest";
import { findAction } from "./find-action.js";

const actions = [
  { id: "takapup", title: "Fix login" },
  { id: "takelop", title: "Fix logout" },
  { id: "zebepod", title: "Refactor" },
  { id: "tag1", title: "++urgent" },
  { id: "tag2", title: "++urgent" },
  { id: "tag3", title: "++backlog" },
];

describe("findAction", () => {
  it("finds by exact ID", () => {
    expect(findAction(actions, "zebepod").id).toBe("zebepod");
  });

  it("finds by unique prefix", () => {
    expect(findAction(actions, "zeb").id).toBe("zebepod");
  });

  it("throws on ambiguous prefix", () => {
    expect(() => findAction(actions, "tak")).toThrow(
      'Ambiguous prefix "tak": matches takapup, takelop',
    );
  });

  it("throws on no match", () => {
    expect(() => findAction(actions, "zzz")).toThrow(
      'No action found matching "zzz"',
    );
  });

  it("finds unique tag by title", () => {
    expect(findAction(actions, "++backlog").id).toBe("tag3");
  });

  it("throws on ambiguous tag title", () => {
    expect(() => findAction(actions, "++urgent")).toThrow(
      'Ambiguous tag "++urgent": matches tag1, tag2',
    );
  });

  it("falls through to ID prefix when tag title not found", () => {
    const items = [{ id: "++nope", title: "something" }];
    expect(findAction(items, "++nope").id).toBe("++nope");
  });
});
