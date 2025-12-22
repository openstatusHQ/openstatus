import { slugify } from "@/content/mdx";
import {
  type MDXData,
  getBlogPosts,
  getChangelogPosts,
  getComparePages,
  getHomePage,
  getProductPages,
  getToolsPages,
} from "@/content/utils";
import { z } from "zod";

const SearchSchema = z.object({
  p: z.enum(["blog", "changelog", "tools", "compare", "product"]).nullish(),
  q: z.string().nullish(),
});

export type SearchParams = z.infer<typeof SearchSchema>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const page = searchParams.get("p");
  const category = searchParams.get("c");

  const params = SearchSchema.safeParse({
    p: page,
    q: query,
    c: category,
  });

  if (!params.success) {
    console.error(params.error);
    return new Response(JSON.stringify({ error: params.error.message }), {
      status: 400,
    });
  }

  if (!params.data.p) {
    return new Response(JSON.stringify([]), {
      status: 200,
    });
  }

  const results = search(params.data).sort((a, b) => {
    return b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime();
  });

  return new Response(JSON.stringify(results), {
    status: 200,
  });
}

function search(params: SearchParams) {
  const { p, q } = params;
  let results: MDXData[] = [];

  if (p === "blog") {
    results = getBlogPosts();
  } else if (p === "changelog") {
    results = getChangelogPosts();
  } else if (p === "tools") {
    results = getToolsPages().filter((tool) => tool.slug !== "checker-slug");
  } else if (p === "compare") {
    results = getComparePages();
  } else if (p === "product") {
    const home = getHomePage();
    // NOTE: we override /home with / for the home.mdx file
    home.href = "/";
    home.metadata.title = "Homepage";
    results = [home, ...getProductPages()];
  }

  const searchMap = new Map<
    string,
    {
      title: boolean;
      content: boolean;
    }
  >();

  results = results
    .filter((result) => {
      if (!q) return true;

      const hasSearchTitle = result.metadata.title
        .toLowerCase()
        .includes(q.toLowerCase());
      const hasSearchContent = result.content
        .toLowerCase()
        .includes(q.toLowerCase());

      searchMap.set(result.slug, {
        title: hasSearchTitle,
        content: hasSearchContent,
      });

      return hasSearchTitle || hasSearchContent;
    })
    .map((result) => {
      const search = searchMap.get(result.slug);

      // Find the closest heading to the search match and add it as an anchor
      let href = result.href;

      //   // Add query parameter for highlighting
      href = `${href}?q=${encodeURIComponent(q || "")}`;

      if (q && search?.content) {
        const headingSlug = findClosestHeading(result.content, q);
        if (headingSlug) {
          href = `${href}#${headingSlug}`;
        }
      }

      const content =
        search?.content || !search?.title
          ? getContentSnippet(result.content, q)
          : "";

      return {
        ...result,
        content,
        href,
      };
    });

  return results;
}

const WORKDS_BEFORE = 2;
const WORKDS_AFTER = 20;

function getContentSnippet(
  mdxContent: string,
  searchQuery: string | null | undefined,
): string {
  if (!searchQuery) {
    return `${mdxContent.slice(0, 100)}...`;
  }

  const content = simpleStripMdx(mdxContent.toLowerCase());
  const searchLower = searchQuery.toLowerCase();
  const matchIndex = content.indexOf(searchLower);

  if (matchIndex === -1) {
    // No match found, return first 100 chars
    return `${content.slice(0, 100)}...`;
  }

  // Find start of snippet (go back N words)
  let start = matchIndex;
  for (let i = 0; i < WORKDS_BEFORE && start > 0; i++) {
    const prevSpace = content.lastIndexOf(" ", start - 2);
    if (prevSpace === -1) break;
    start = prevSpace + 1;
  }

  // Find end of snippet (go forward N words)
  let end = matchIndex + searchQuery.length;
  for (let i = 0; i < WORKDS_AFTER && end < content.length; i++) {
    const nextSpace = content.indexOf(" ", end + 1);
    if (nextSpace === -1) {
      end = content.length;
      break;
    }
    end = nextSpace;
  }

  // Extract snippet
  let snippet = content.slice(start, end).trim();

  if (!snippet) return snippet;

  if (start > 0) snippet = `...${snippet}`;
  if (end < content.length) snippet = `${snippet}...`;

  return snippet;
}

export function simpleStripMdx(input: string) {
  return input
    .replace(/<[^>]+>/g, "") // strip JSX tags
    .replace(/^#{1,6}\s+/gm, "") // strip markdown heading symbols, keep text
    .replace(/!\[.*?\]\(.*?\)/g, "") // strip images
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // keep link text
    .replace(/\*\*(.*?)\*\*/g, "$1") // strip bold
    .replace(/__(.*?)__/g, "$1") // strip italic
    .replace(/_(.*?)_/g, "$1") // strip underline
    .replace(/[`*>~]/g, "") // strip most formatting
    .replace(/<\s*\/?\s*script[^>]*>/gi, "") // ensure script tags are fully removed
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

/**
 * Find the closest heading before the search match and return its slug
 */
function findClosestHeading(
  mdxContent: string,
  searchQuery: string | null | undefined,
): string | null {
  if (!searchQuery) return null;

  const searchLower = searchQuery.toLowerCase();
  const contentLower = mdxContent.toLowerCase();
  const matchIndex = contentLower.indexOf(searchLower);

  if (matchIndex === -1) return null;

  // Look for headings before the match (## Heading, ### Heading, etc.)
  const contentBeforeMatch = mdxContent.slice(0, matchIndex);
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings: { text: string; index: number }[] = [];

  let match = headingRegex.exec(contentBeforeMatch);
  while (match !== null) {
    headings.push({
      text: match[1].trim(),
      index: match.index,
    });
    match = headingRegex.exec(contentBeforeMatch);
  }

  // Return the closest heading (last one before the match)
  if (headings.length > 0) {
    const closestHeading = headings[headings.length - 1];
    return slugify(closestHeading.text);
  }

  return null;
}
