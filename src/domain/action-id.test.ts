import { describe, it, expect } from "vitest";
import { generateSlug } from "./action-id.js";

describe("generateSlug", () => {
  it("returns a 7-character string", () => {
    expect(generateSlug()).toHaveLength(7);
  });

  it("follows CVCVCVC pattern", () => {
    const slug = generateSlug();
    const consonants = "bcdfghjklmnprstvwxz";
    const vowels = "aeiou";
    for (let i = 0; i < slug.length; i++) {
      const chars = i % 2 === 0 ? consonants : vowels;
      expect(chars).toContain(slug[i]);
    }
  });

  it("generates unique slugs", () => {
    const slugs = new Set(Array.from({ length: 50 }, () => generateSlug()));
    expect(slugs.size).toBe(50);
  });

  it("avoids existing slugs", () => {
    const existing = new Set([generateSlug()]);
    const slug = generateSlug(existing);
    expect(existing.has(slug)).toBe(false);
  });
});
