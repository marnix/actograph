import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createProgram } from "./program.js";

function testProgram(...args: string[]) {
  const program = createProgram();
  program.exitOverride();
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {},
  });
  return program.parseAsync(["node", "acto", ...args]);
}

describe("CLI excess arguments", () => {
  it("rejects extra arguments on list", async () => {
    await expect(testProgram("list", "extra")).rejects.toThrow();
  });

  it("rejects extra arguments on do", async () => {
    await expect(testProgram("do", "title", "extra")).rejects.toThrow();
  });

  it("rejects extra arguments on go", async () => {
    await expect(testProgram("go", "slug", "extra")).rejects.toThrow();
  });
});

describe("CLI tag state rejection", () => {
  let dataDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitMock: any;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "acto-test-"));
    exitMock = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as never);
    await testProgram("--data-dir", dataDir, "do", "++urgent");
    exitMock.mockClear();
  });

  afterEach(() => {
    exitMock.mockRestore();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("rejects state change on tag action", async () => {
    await testProgram("--data-dir", dataDir, "go", "++urgent");
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});
