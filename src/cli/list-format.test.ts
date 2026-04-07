import { describe, it, expect } from "vitest";
import type { Action } from "../domain/action.js";
import type { Priority } from "../domain/priority.js";
import {
  buildAnnotations,
  formatActionLabel,
  formatTagLabel,
} from "./list-format.js";

function makeAction(
  id: string,
  title: string,
  state: "open" | "active" | "done" | "skipped" = "open",
  prereqIds: string[] = [],
): Action {
  return {
    id,
    title,
    state,
    prerequisites: prereqIds.map((actionId) => ({ actionId, createdAt: 0 })),
  };
}

describe("buildAnnotations", () => {
  it("returns empty maps when no relations", () => {
    const a = makeAction("a1", "Do stuff");
    const { reqPreds, prioPreds } = buildAnnotations([a], [a], []);
    expect(reqPreds.size).toBe(0);
    expect(prioPreds.size).toBe(0);
  });

  it("includes direct prerequisite", () => {
    const a = makeAction("a1", "First");
    const b = makeAction("a2", "Second", "open", ["a1"]);
    const { reqPreds } = buildAnnotations([a, b], [a, b], []);
    expect(reqPreds.get("a2")).toEqual(new Set(["a1"]));
  });

  it("excludes prerequisite not in visible set", () => {
    const a = makeAction("a1", "First");
    const b = makeAction("a2", "Second", "open", ["a1"]);
    const { reqPreds } = buildAnnotations([b], [a, b], []);
    expect(reqPreds.size).toBe(0);
  });

  it("includes direct priority", () => {
    const a = makeAction("a1", "First");
    const b = makeAction("a2", "Second");
    const prios: Priority[] = [{ higher: "a1", lower: "a2", createdAt: 0 }];
    const { prioPreds } = buildAnnotations([a, b], [a, b], prios);
    expect(prioPreds.get("a2")).toEqual(new Set(["a1"]));
  });

  it("includes tag-expanded priority", () => {
    const t1 = makeAction("t1", "++urgent");
    const t2 = makeAction("t2", "++later");
    const a = makeAction("a1", "Fix ++urgent");
    const b = makeAction("a2", "Polish ++later");
    const prios: Priority[] = [{ higher: "t1", lower: "t2", createdAt: 0 }];
    const all = [t1, t2, a, b];
    const { prioPreds } = buildAnnotations([a, b], all, prios);
    expect(prioPreds.get("a2")).toEqual(new Set(["a1"]));
  });
});

describe("formatActionLabel", () => {
  const empty = { reqPreds: new Map(), prioPreds: new Map() };

  it("shows open state", () => {
    expect(formatActionLabel(makeAction("abc", "Do it"), empty)).toBe(
      "[ ] Do it  (abc)",
    );
  });

  it("shows active state", () => {
    expect(formatActionLabel(makeAction("abc", "Do it", "active"), empty)).toBe(
      "[▶] Do it  (abc)",
    );
  });

  it("shows done state", () => {
    expect(formatActionLabel(makeAction("abc", "Do it", "done"), empty)).toBe(
      "[✓] Do it  (abc)",
    );
  });

  it("shows skipped state", () => {
    expect(
      formatActionLabel(makeAction("abc", "Do it", "skipped"), empty),
    ).toBe("[–] Do it  (abc)");
  });

  it("appends req annotation", () => {
    const ann = {
      reqPreds: new Map([["abc", new Set(["def"])]]),
      prioPreds: new Map(),
    };
    expect(formatActionLabel(makeAction("abc", "Do it"), ann)).toBe(
      "[ ] Do it  (abc)  ← req:def",
    );
  });

  it("appends req and prio annotations", () => {
    const ann = {
      reqPreds: new Map([["abc", new Set(["def"])]]),
      prioPreds: new Map([["abc", new Set(["ghi"])]]),
    };
    expect(formatActionLabel(makeAction("abc", "Do it"), ann)).toBe(
      "[ ] Do it  (abc)  ← req:def, prio:ghi",
    );
  });
});

describe("formatTagLabel", () => {
  const empty = { reqPreds: new Map(), prioPreds: new Map() };

  it("shows tag title and id", () => {
    expect(formatTagLabel(makeAction("t1", "++urgent"), empty)).toBe(
      "++urgent  (t1)",
    );
  });

  it("appends prio annotation", () => {
    const ann = {
      reqPreds: new Map(),
      prioPreds: new Map([["t2", new Set(["t1"])]]),
    };
    expect(formatTagLabel(makeAction("t2", "++later"), ann)).toBe(
      "++later  (t2)  ← prio:t1",
    );
  });
});
