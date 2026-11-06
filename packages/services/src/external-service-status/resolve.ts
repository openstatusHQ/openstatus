type Named = { slug: string; name: string; aliases?: string[] };

export function normalize(value: string): string {
  return value.trim().toLowerCase();
}

// Linear on purpose: the input is untrusted (MCP callers), so no regex that
// backtracks on long runs of "-".
export function slugify(value: string): string {
  const parts = normalize(value).split(/[^a-z0-9]+/);
  return parts.filter((p) => p.length > 0).join("-");
}

/**
 * Exact slug, alias or name wins; otherwise the closest names are returned
 * as suggestions so an agent can retry with one of them.
 */
export function resolveByName<T extends Named>(
  rows: T[],
  query: string,
  maxSuggestions = 5,
): { match: T | null; suggestions: T[] } {
  const q = normalize(query);
  const qSlug = slugify(query);
  // "!!!" has no letters or digits; an empty slug would prefix-match everything.
  if (!q || !qSlug) return { match: null, suggestions: [] };

  const exact = rows.find(
    (r) =>
      r.slug === qSlug ||
      normalize(r.name) === q ||
      (r.aliases ?? []).some((a) => a === qSlug || normalize(a) === q),
  );
  if (exact) return { match: exact, suggestions: [] };

  const scored = rows
    .map((r) => {
      const name = normalize(r.name);
      let score = 0;
      if (name.startsWith(q) || r.slug.startsWith(qSlug)) score = 3;
      else if (name.includes(q) || r.slug.includes(qSlug)) score = 2;
      else if ((r.aliases ?? []).some((a) => normalize(a).includes(q)))
        score = 1;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.r.name.length - b.r.name.length);

  // A single prefix hit ("cloudfl") is unambiguous enough to answer.
  if (scored.length === 1 && scored[0].score === 3) {
    return { match: scored[0].r, suggestions: [] };
  }
  return {
    match: null,
    suggestions: scored.slice(0, maxSuggestions).map((x) => x.r),
  };
}
