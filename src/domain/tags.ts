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

/** Return tag titles (e.g. "++foo") referenced in `title` that have no tag action in `actions`. */
export function missingTagActions(
  title: string,
  actions: { title: string }[],
): string[] {
  if (isTagTitle(title)) return [];
  const existing = new Set(
    actions.filter((a) => isTagTitle(a.title)).map((a) => a.title.trim()),
  );
  return parseTags(title)
    .map((t) => `++${t}`)
    .filter((t) => !existing.has(t));
}

/**
 * Create tag actions for all tags referenced in any action title but
 * missing a tag action. Returns the titles of created tag actions.
 */
export function createMissingTagActions<T extends { title: string }>(
  actions: T[],
  factory: (title: string) => T,
): string[] {
  const created: string[] = [];
  const seen = new Set<string>();
  for (const a of [...actions]) {
    for (const tag of missingTagActions(a.title, actions)) {
      if (!seen.has(tag)) {
        seen.add(tag);
        actions.push(factory(tag));
        created.push(tag);
      }
    }
  }
  return created;
}
