const SITE_URL = "https://www.openstatus.dev";

// Markdown leaves the site, so frontmatter links are absolute.
export function canonicalUrl(pathOrUrl: string) {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${SITE_URL}${pathOrUrl}`;
}

// JSON strings are valid double-quoted YAML scalars, quotes included.
export function frontmatter(fields: Record<string, string | undefined>) {
  const lines = Object.entries(fields)
    .filter((entry): entry is [string, string] => entry[1] != null)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}
