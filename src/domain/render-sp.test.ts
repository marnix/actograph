import { describe, it, expect } from "vitest";
import { renderSP } from "./render-sp.js";
import type { SPNode } from "./sp-decompose.js";

const id = (s: string) => s;

// Trim leading newline and trailing whitespace from template literals
const trim = (s: string) => s.replace(/^\n/, "").trimEnd();

describe("renderSP", () => {
  it("single action", () => {
    expect(renderSP({ type: "action", id: "a" }, id)).toBe("a");
  });

  it("two sequential actions", () => {
    const sp: SPNode = {
      type: "seq",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
      ],
    };
    expect(renderSP(sp, id)).toBe(
      trim(`
>>  a
>>  b`),
    );
  });

  it("two parallel actions", () => {
    const sp: SPNode = {
      type: "par",
      children: [
        { type: "action", id: "a" },
        { type: "action", id: "b" },
      ],
    };
    expect(renderSP(sp, id)).toBe(
      trim(`
||  a
||  b`),
    );
  });

  it("seq of two par groups (design doc example shape)", () => {
    const sp: SPNode = {
      type: "seq",
      children: [
        {
          type: "par",
          children: [
            { type: "action", id: "extend widget" },
            { type: "action", id: "mock-up screen" },
          ],
        },
        {
          type: "par",
          children: [
            { type: "action", id: "adopt widget extension" },
            { type: "action", id: "build screen" },
          ],
        },
      ],
    };
    expect(renderSP(sp, id)).toBe(
      trim(`
>>  ||  extend widget
>>  ||  mock-up screen
>>
>>  ||  adopt widget extension
>>  ||  build screen`),
    );
  });

  it("diamond: seq(a, par(b, c), d)", () => {
    const sp: SPNode = {
      type: "seq",
      children: [
        { type: "action", id: "a" },
        {
          type: "par",
          children: [
            { type: "action", id: "b" },
            { type: "action", id: "c" },
          ],
        },
        { type: "action", id: "d" },
      ],
    };
    expect(renderSP(sp, id)).toBe(
      trim(`
>>  a
>>  ||  b
>>  ||  c
>>  d`),
    );
  });

  it("uses label function", () => {
    const sp: SPNode = {
      type: "seq",
      children: [
        { type: "action", id: "x" },
        { type: "action", id: "y" },
      ],
    };
    expect(renderSP(sp, (s) => `[${s}]`)).toBe(
      trim(`
>>  [x]
>>  [y]`),
    );
  });

  it("nested: seq(a, par(seq(b, c), d))", () => {
    const sp: SPNode = {
      type: "seq",
      children: [
        { type: "action", id: "a" },
        {
          type: "par",
          children: [
            {
              type: "seq",
              children: [
                { type: "action", id: "b" },
                { type: "action", id: "c" },
              ],
            },
            { type: "action", id: "d" },
          ],
        },
      ],
    };
    expect(renderSP(sp, id)).toBe(
      trim(`
>>  a
>>  ||  >>  b
>>  ||  >>  c
>>  ||  d`),
    );
  });
});
