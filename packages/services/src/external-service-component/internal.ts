const MAX_SLUG_LENGTH = 64;

export function slugifyComponentName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-$/, "");
  return slug || "component";
}

export type ExistingComponentSlug = {
  upstreamComponentId: string;
  name: string;
  slug: string;
  aliases: string[];
};

export type ComponentSlugAssignment = {
  slug: string;
  aliases: string[];
};

function uniqueSlug(
  desired: string,
  reserved: Set<string>,
  owned: Set<string>,
): string {
  const isFree = (candidate: string) =>
    owned.has(candidate) || !reserved.has(candidate);
  if (isFree(desired)) return desired;
  let suffix = 2;
  while (!isFree(`${desired}-${suffix}`)) suffix++;
  return `${desired}-${suffix}`;
}

// Derives a stable, unique-per-service slug for each component. Existing
// components keep their slug while the name is unchanged; on rename the old slug
// is preserved in `aliases` (so old URLs 308 to the new one) and a fresh slug is
// assigned, suffixed (`-2`) when it would collide with another component's slug
// or alias. Processed in upstream-id order so collision suffixes stay stable.
export function assignComponentSlugs(args: {
  existing: ExistingComponentSlug[];
  incoming: Array<{ upstreamComponentId: string; name: string }>;
}): Map<string, ComponentSlugAssignment> {
  const existingByUpstream = new Map(
    args.existing.map((e) => [e.upstreamComponentId, e]),
  );

  const reserved = new Set<string>();
  for (const e of args.existing) {
    reserved.add(e.slug);
    for (const alias of e.aliases) reserved.add(alias);
  }

  const ordered = [...args.incoming].sort((a, b) =>
    a.upstreamComponentId.localeCompare(b.upstreamComponentId),
  );

  const out = new Map<string, ComponentSlugAssignment>();
  for (const c of ordered) {
    const prev = existingByUpstream.get(c.upstreamComponentId);

    if (prev && prev.name === c.name) {
      out.set(c.upstreamComponentId, {
        slug: prev.slug,
        aliases: prev.aliases,
      });
      continue;
    }

    const owned = new Set<string>(prev ? [prev.slug, ...prev.aliases] : []);
    const slug = uniqueSlug(slugifyComponentName(c.name), reserved, owned);

    const aliases = new Set<string>(prev?.aliases ?? []);
    if (prev && prev.slug !== slug) aliases.add(prev.slug);
    aliases.delete(slug);

    reserved.add(slug);
    out.set(c.upstreamComponentId, { slug, aliases: [...aliases] });
  }
  return out;
}
