// Tag utilities for parsing ++tagname tokens from action titles

const TAG_PATTERN = /\+\+(\w+)/g;

/** Extract all tag names from an action title (without the ++ prefix). */
export function parseTags(title: string): string[] {
  const tags: string[] = [];
  for (const match of title.matchAll(TAG_PATTERN)) {
    if (match[1] !== undefined) tags.push(match[1]);
  }
  return tags;
}

/** True if the title is *only* a single ++tagname (with optional whitespace). */
export function isTagTitle(title: string): boolean {
  return /^\s*\+\+\w+\s*$/.test(title);
}

/**
 * Get the tag name from a tag-only title.
 * Returns undefined if the title is not a tag-only title.
 */
export function tagName(title: string): string | undefined {
  const m = title.match(/^\s*\+\+(\w+)\s*$/);
  return m ? m[1] : undefined;
}
