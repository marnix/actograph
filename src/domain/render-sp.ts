// ASCII rendering of an SP tree.
//
// Sequential context shown with ">>" on the left, parallel items with "||".
// Example output for seq(par(a, b), par(c, d)):
//
//   >>  ||  a
//   >>  ||  b
//   >>
//   >>  ||  c
//   >>  ||  d

import type { SPNode } from "./sp-decompose.js";

export interface RenderOptions {
  /** Edges added for N-free resolution: Set of "source\0target" strings. */
  nFreeEdges?: Set<string>;
  /** Short label for N-free edge sources (defaults to label). */
  shortLabel?: (id: string) => string;
}

export function renderSP(
  node: SPNode,
  label: (id: string) => string,
  options?: RenderOptions,
): string {
  const lines: string[] = [];
  render(
    node,
    label,
    [],
    lines,
    options?.nFreeEdges,
    options?.shortLabel ?? label,
  );
  return lines.join("\n");
}

function render(
  node: SPNode,
  label: (id: string) => string,
  prefix: string[],
  lines: string[],
  nFreeEdges?: Set<string>,
  shortLabel?: (id: string) => string,
): void {
  switch (node.type) {
    case "action": {
      let line = [...prefix, label(node.id)].join("  ");
      if (nFreeEdges) {
        const sl = shortLabel ?? label;
        const parts: string[] = [];
        for (const key of nFreeEdges) {
          const [src, tgt] = key.split("\0") as [string, string];
          if (tgt === node.id) parts.push("↑" + sl(src));
          if (src === node.id) parts.push("↓" + sl(tgt));
        }
        if (parts.length > 0) {
          line += "  || " + parts.join(", ");
        }
      }
      lines.push(line);
      break;
    }
    case "par":
      for (let i = 0; i < node.children.length; i++) {
        if (
          i > 0 &&
          !(
            node.children[i - 1]!.type === "action" &&
            node.children[i]!.type === "action"
          )
        ) {
          lines.push([...prefix, "||"].join("  "));
        }
        render(
          node.children[i]!,
          label,
          [...prefix, "||"],
          lines,
          nFreeEdges,
          shortLabel,
        );
      }
      break;
    case "seq":
      for (let i = 0; i < node.children.length; i++) {
        if (
          i > 0 &&
          !(
            node.children[i - 1]!.type === "action" &&
            node.children[i]!.type === "action"
          )
        ) {
          lines.push([...prefix, ">>"].join("  "));
        }
        render(
          node.children[i]!,
          label,
          [...prefix, ">>"],
          lines,
          nFreeEdges,
          shortLabel,
        );
      }
      break;
  }
}
