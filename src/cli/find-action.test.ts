import { describe, it, expect } from "vitest";
import { findAction } from "./find-action.js";

const actions = [
  { slug: "takapup", title: "Fix login" },
  { slug: "takelop", title: "Fix logout" },
  { slug: "zebepod", title: "Refactor" },
  { slug: "tag1slu", title: "++urgent" },
  { slug: "tag2slu", title: "++urgent" },
  { slug: "tag3slu", title: "++backlog" },
];

describe("findAction", () => {
  it("finds by exact slug", () => {
    expect(findAction(actions, "zebepod").slug).toBe("zebepod");
  });

  it("finds by unique prefix", () => {
    expect(findAction(actions, "zeb").slug).toBe("zebepod");
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
    expect(findAction(actions, "++backlog").slug).toBe("tag3slu");
  });

  it("throws on ambiguous tag title", () => {
    expect(() => findAction(actions, "++urgent")).toThrow(
      'Ambiguous tag "++urgent": matches tag1slu, tag2slu',
    );
  });

  it("falls through to slug prefix when tag title not found", () => {
    const items = [{ slug: "++nope", title: "something" }];
    expect(findAction(items, "++nope").slug).toBe("++nope");
  });
});
