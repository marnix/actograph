import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createProgram } from "./program.js";

function setupProgram(writeErr: (s: string) => void = () => {}) {
  const program = createProgram();
  program.exitOverride();
  program.configureOutput({ writeErr, writeOut: () => {} });
  for (const cmd of program.commands) {
    cmd.exitOverride();
    cmd.configureOutput({ writeErr, writeOut: () => {} });
  }
  return program;
}

function testProgram(...args: string[]) {
  return setupProgram().parseAsync(["node", "acto", ...args]);
}

function testProgramStderr(...args: string[]): {
  promise: Promise<unknown>;
  stderr: () => string;
} {
  const lines: string[] = [];
  const program = setupProgram((s) => lines.push(s));
  return {
    promise: program.parseAsync(["node", "acto", ...args]),
    stderr: () => lines.join(""),
  };
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
    const { promise, stderr } = testProgramStderr("list", "++tag", "extra");
    await expect(promise).rejects.toThrow();
    expect(stderr()).toMatch(/too many arguments/);
  });

  it("rejects extra arguments on do", async () => {
    const { promise, stderr } = testProgramStderr("do", "title", "extra");
    await expect(promise).rejects.toThrow();
    expect(stderr()).toMatch(/too many arguments/);
  });

  it("rejects extra arguments on go", async () => {
    const { promise, stderr } = testProgramStderr("go", "slug", "extra");
    await expect(promise).rejects.toThrow();
    expect(stderr()).toMatch(/too many arguments/);
  });
});

describe("CLI tag state rejection", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "acto-test-"));
    await testProgram("--data-dir", dataDir, "do", "++urgent");
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("rejects state change on tag action", async () => {
    await expect(
      testProgram("--data-dir", dataDir, "go", "++urgent"),
    ).rejects.toThrow(/Cannot change state of tag action/);
  });
});

describe("CLI parallel action sorting", () => {
  let dataDir: string;
  let clock: number;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "acto-sort-"));
    clock = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => clock++);
    // Create three actions with deterministic timestamps
    await testProgram("--data-dir", dataDir, "do", "Alpha task");
    await testProgram("--data-dir", dataDir, "do", "Beta task");
    await testProgram("--data-dir", dataDir, "do", "Gamma task");
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

describe("CLI show slug on create", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "acto-slug-"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("prints the slug when creating an action", async () => {
    const output = await captureStdout(() =>
      testProgram("--data-dir", dataDir, "do", "Test task"),
    );
    expect(output).toMatch(/^Added: "Test task" \(\w{7}\)$/);
  });
});

describe("CLI interactive do", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "acto-ido-"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("prompts and creates action when no title given", async () => {
    // Simulate stdin by providing input via a Readable stream
    const { Readable } = await import("stream");
    const mockStdin = new Readable({ read() {} });
    const origStdin = process.stdin;
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      writable: true,
    });
    try {
      const promise = captureStdout(() =>
        testProgram("--data-dir", dataDir, "do"),
      );
      // Feed the title after a tick (readline needs to be listening)
      await new Promise((r) => setTimeout(r, 10));
      mockStdin.push("Interactive task\n");
      mockStdin.push(null);
      const output = await promise;
      expect(output).toMatch(/^Added: "Interactive task" \(\w{7}\)$/);
    } finally {
      Object.defineProperty(process, "stdin", {
        value: origStdin,
        writable: true,
      });
    }
  });
});

describe("CLI list by tag", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "acto-ltag-"));
    await testProgram("--data-dir", dataDir, "do", "Fix bug ++urgent");
    await testProgram("--data-dir", dataDir, "do", "Write docs ++later");
    await testProgram("--data-dir", dataDir, "do", "Plain task");
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists only actions with the given tag", async () => {
    const output = await captureStdout(() =>
      testProgram("--data-dir", dataDir, "list", "++urgent"),
    );
    expect(output).toContain("Fix bug ++urgent");
    expect(output).not.toContain("Write docs");
    expect(output).not.toContain("Plain task");
  });

  it("shows empty message when no actions match", async () => {
    const output = await captureStdout(() =>
      testProgram("--data-dir", dataDir, "list", "++nonexistent"),
    );
    expect(output).toContain("No actions with tag ++nonexistent.");
  });
});
