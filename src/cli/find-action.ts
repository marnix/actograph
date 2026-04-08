// Resolve an action by slug prefix or ++tagname.
// Throws on not-found or ambiguous match.

export function findAction<T extends { slug: string; title: string }>(
  actions: T[],
  prefix: string,
): T {
  if (prefix.startsWith("++")) {
    const tagMatches = actions.filter((a) => a.title === prefix);
    if (tagMatches.length === 1) return tagMatches[0] as T;
    if (tagMatches.length > 1) {
      throw new Error(
        `Ambiguous tag "${prefix}": matches ${tagMatches.map((a) => a.slug).join(", ")}`,
      );
    }
  }
  const matches = actions.filter((a) => a.slug.startsWith(prefix));
  if (matches.length === 0) {
    throw new Error(`No action found matching "${prefix}"`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous prefix "${prefix}": matches ${matches.map((a) => a.slug).join(", ")}`,
    );
  }
  const [match] = matches as [T];
  return match;
}
