// index.ts - CLI entry point

import { createProgram } from "./cli/program.js";

createProgram()
  .parseAsync()
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    process.exit(1);
  });
