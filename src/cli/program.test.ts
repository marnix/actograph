import { describe, it, expect } from "vitest";
import { createProgram } from "./program.js";

function testProgram() {
  const program = createProgram();
  program.exitOverride();
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {},
  });
  return program;
}

describe("CLI excess arguments", () => {
  it("rejects extra arguments on list", async () => {
    await expect(
      testProgram().parseAsync(["node", "acto", "list", "extra"]),
    ).rejects.toThrow();
  });

  it("rejects extra arguments on do", async () => {
    await expect(
      testProgram().parseAsync(["node", "acto", "do", "title", "extra"]),
    ).rejects.toThrow();
  });

  it("rejects extra arguments on go", async () => {
    await expect(
      testProgram().parseAsync(["node", "acto", "go", "slug", "extra"]),
    ).rejects.toThrow();
  });
});
