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

function captureStdout(fn: () => Promise<unknown>): Promise<string> {
  const lines: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  return fn()
    .finally(() => {
      console.log = origLog;
    })
    .then(() => lines.join("\n"));
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

describe("CLI parallel action sorting", () => {
  let dataDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitMock: any;
  let clock: number;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "acto-sort-"));
    exitMock = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as never);
    clock = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => clock++);
    // Create three actions with deterministic timestamps
    await testProgram("--data-dir", dataDir, "do", "Alpha task");
    await testProgram("--data-dir", dataDir, "do", "Beta task");
    await testProgram("--data-dir", dataDir, "do", "Gamma task");
    exitMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists active actions before open actions", async () => {
    // Find the slug for Beta by capturing list -a output
    const allOutput = await captureStdout(() =>
      testProgram("--data-dir", dataDir, "list", "-a"),
    );
    const betaMatch = allOutput.match(/Beta task\s+\((\w+)\)/);
    expect(betaMatch).not.toBeNull();
    const betaSlug = betaMatch![1]!;

    // Start Beta (open -> active)
    await testProgram("--data-dir", dataDir, "go", betaSlug);

    const output = await captureStdout(() =>
      testProgram("--data-dir", dataDir, "list"),
    );
    const lines = output.trim().split("\n");
    const titles = lines
      .map((l) => l.match(/\]\s+(.+?)\s+\(/)?.[1])
      .filter(Boolean);
    expect(titles.indexOf("Beta task")).toBeLessThan(
      titles.indexOf("Alpha task"),
    );
    expect(titles.indexOf("Beta task")).toBeLessThan(
      titles.indexOf("Gamma task"),
    );
  });
});

describe("CLI auto-add tags", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "acto-tags-"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("creates tag action when adding action with unknown tag", async () => {
    await testProgram("--data-dir", dataDir, "do", "Fix bug ++urgent");
    const output = await captureStdout(() =>
      testProgram("--data-dir", dataDir, "list", "--tags"),
    );
    expect(output).toContain("++urgent");
  });

  it("does not duplicate existing tag action", async () => {
    await testProgram("--data-dir", dataDir, "do", "Fix bug ++urgent");
    await testProgram("--data-dir", dataDir, "do", "Other ++urgent");
    const output = await captureStdout(() =>
      testProgram("--data-dir", dataDir, "list", "--tags"),
    );
    const matches = output.match(/\+\+urgent/g);
    expect(matches).toHaveLength(1);
  });
});
