type Searchable = {
  name: string;
  slug: string;
  aliases: string[];
};

export function filterServices<T extends Searchable>(
  rows: T[],
  q: string,
): T[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter(
    (r) =>
      r.name.toLowerCase().includes(needle) ||
      r.slug.toLowerCase().includes(needle) ||
      r.aliases.some((a) => a.toLowerCase().includes(needle)),
  );
}
