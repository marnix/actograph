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

export function renderSP(node: SPNode, label: (id: string) => string): string {
  const lines: string[] = [];
  render(node, label, [], lines);
  return lines.join("\n");
}

function render(
  node: SPNode,
  label: (id: string) => string,
  prefix: string[],
  lines: string[],
): void {
  switch (node.type) {
    case "action":
      lines.push([...prefix, label(node.id)].join("  "));
      break;
    case "par":
      for (let i = 0; i < node.children.length; i++) {
        if (
          i > 0 &&
          node.children[i]!.type === "seq" &&
          node.children[i - 1]!.type === "seq"
        ) {
          lines.push([...prefix, "||"].join("  "));
        }
        render(node.children[i]!, label, [...prefix, "||"], lines);
      }
      break;
    case "seq":
      for (let i = 0; i < node.children.length; i++) {
        if (
          i > 0 &&
          node.children[i]!.type === "par" &&
          node.children[i - 1]!.type === "par"
        ) {
          lines.push([...prefix, ">>"].join("  "));
        }
        render(node.children[i]!, label, [...prefix, ">>"], lines);
      }
      break;
  }
}
