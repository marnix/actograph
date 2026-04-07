import { describe, it, expect } from "vitest";
import { generateActionId } from "./action-id.js";

describe("generateActionId", () => {
  it("returns a 7-character string", () => {
    expect(generateActionId()).toHaveLength(7);
  });

  it("follows CVCVCVC pattern", () => {
    const id = generateActionId();
    const consonants = "bcdfghjklmnprstvwxz";
    const vowels = "aeiou";
    for (let i = 0; i < id.length; i++) {
      const chars = i % 2 === 0 ? consonants : vowels;
      expect(chars).toContain(id[i]);
    }
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateActionId()));
    expect(ids.size).toBe(50);
  });
});
