import { describe, it, expect } from "vitest";
import { parseTags, isTagTitle, tagName } from "./tags.js";

describe("parseTags", () => {
  it("returns empty for plain title", () => {
    expect(parseTags("Fix the login bug")).toEqual([]);
  });

  it("extracts a single tag", () => {
    expect(parseTags("Fix login ++urgent")).toEqual(["urgent"]);
  });

  it("extracts multiple tags", () => {
    expect(parseTags("Fix login ++urgent ++v2")).toEqual(["urgent", "v2"]);
  });

  it("extracts tag from tag-only title", () => {
    expect(parseTags("++urgent")).toEqual(["urgent"]);
  });
});

describe("isTagTitle", () => {
  it("true for tag-only title", () => {
    expect(isTagTitle("++urgent")).toBe(true);
  });

  it("true with surrounding whitespace", () => {
    expect(isTagTitle("  ++urgent  ")).toBe(true);
  });

  it("false for title with description and tag", () => {
    expect(isTagTitle("Fix login ++urgent")).toBe(false);
  });

  it("false for plain title", () => {
    expect(isTagTitle("Fix the login bug")).toBe(false);
  });

  it("false for multiple tags only", () => {
    expect(isTagTitle("++urgent ++v2")).toBe(false);
  });
});

describe("tagName", () => {
  it("returns name for tag-only title", () => {
    expect(tagName("++urgent")).toBe("urgent");
  });

  it("returns undefined for non-tag title", () => {
    expect(tagName("Fix login ++urgent")).toBeUndefined();
  });
});
