import {
  type MDXData,
  getBlogPosts,
  getCategories,
  getChangelogPosts,
  getComparePages,
  getToolsPages,
} from "@/content/utils";
import { z } from "zod";

const categories = getCategories();

const SearchSchema = z.object({
  t: z.enum(["blog", "changelog", "tools", "compare"]),
  q: z.string().nullish(),
  c: z.enum([""]).nullish(),
});

export type SearchParams = z.infer<typeof SearchSchema>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const type = searchParams.get("t");
  const category = searchParams.get("c");

  const params = SearchSchema.safeParse({
    t: type,
    q: query,
    c: category,
  });

  if (!params.success) {
    console.error(params.error);
    return new Response(JSON.stringify({ error: params.error.message }), {
      status: 400,
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
  const { t, q, c } = params;
  let results: MDXData[] = [];

  if (t === "blog") {
    results = getBlogPosts();
  } else if (t === "changelog") {
    results = getChangelogPosts();
  } else if (t === "tools") {
    results = getToolsPages().filter((tool) => tool.slug !== "checker-slug");
  } else if (t === "compare") {
    results = getComparePages();
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

      if (c) {
        return result.metadata.category === c;
      }

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

      return {
        ...result,
        content:
          search?.content || !search?.title
            ? getContentSnippet(result.content, q)
            : "",
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
    return mdxContent.slice(0, 100) + "...";
  }

  const content = simpleStripMdx(mdxContent.toLowerCase());
  const searchLower = searchQuery.toLowerCase();
  const matchIndex = content.indexOf(searchLower);

  if (matchIndex === -1) {
    // No match found, return first 100 chars
    return content.slice(0, 100) + "...";
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

  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";

  return snippet;
}

export function simpleStripMdx(input: string) {
  return input
    .replace(/<[^>]+>/g, "") // strip JSX tags
    .replace(/!\[.*?\]\(.*?\)/g, "") // strip images
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // keep link text
    .replace(/\*\*(.*?)\*\*/g, "$1") // strip bold
    .replace(/__(.*?)__/g, "$1") // strip italic
    .replace(/_(.*?)_/g, "$1") // strip underline
    .replace(/[`*>~]/g, "") // strip most formatting
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}
