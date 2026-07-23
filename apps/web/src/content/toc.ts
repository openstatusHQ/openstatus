import { slugify } from "./mdx-components/heading";

export type TocItem = { depth: 2 | 3; text: string; slug: string };

// Extract h2/h3 headings from raw MDX for the table of contents. Slugs are
// produced with the same `slugify` that `createHeading` uses at render time, so
// the TOC links resolve to the real heading ids. Fenced code blocks are skipped
// so `## comment` lines inside code don't leak into the TOC.
export function extractHeadings(source: string): TocItem[] {
  const items: TocItem[] = [];
  let inFence = false;

  for (const line of source.split("\n")) {
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;

    const depth = heading[1].length as 2 | 3;
    const text = heading[2].trim();
    items.push({ depth, text, slug: slugify(text) });
  }

  return items;
}
