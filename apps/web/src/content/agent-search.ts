import { CORPUS_LABELS, type SearchResult } from "./search-meta";

const SITE_URL = "https://www.openstatus.dev";

export const AGENT_SEARCH_PATH = "/.well-known/search";
export const AGENT_SEARCH_DEFAULT_LIMIT = 10;
export const AGENT_SEARCH_MAX_LIMIT = 50;

/** The four fields an agent reads to find and call the site search. */
export const AGENT_SEARCH = {
  instructions:
    "Search openstatus docs, guides, blog and product pages. Replace {query} with URL-encoded keywords or a question. Returns markdown with links to matching pages, not a generated answer.",
  endpoint: `${SITE_URL}${AGENT_SEARCH_PATH}?q={query}`,
  method: "GET",
  documentation: `${SITE_URL}${AGENT_SEARCH_PATH}`,
} as const;

/** `<meta name="agent:*">` tags, as Next's `metadata.other`. */
export const agentSearchMeta: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_SEARCH).map(([key, value]) => [`agent:${key}`, value]),
);

/** The same fields as a nested YAML mapping for markdown frontmatter. */
export const agentSearchFrontmatter = [
  "agent:",
  ...Object.entries(AGENT_SEARCH).map(
    ([key, value]) => `  ${key}: ${JSON.stringify(value)}`,
  ),
].join("\n");

export function parseSearchLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return AGENT_SEARCH_DEFAULT_LIMIT;
  return Math.min(n, AGENT_SEARCH_MAX_LIMIT);
}

export function searchUsageMarkdown(): string {
  return `# openstatus search

Search the openstatus docs, guides, blog, changelog and product pages.

\`\`\`
GET ${AGENT_SEARCH.endpoint}
\`\`\`

- \`q\` (required): keywords or a question, URL-encoded.
- \`limit\` (optional): number of results, ${AGENT_SEARCH_DEFAULT_LIMIT} by default, ${AGENT_SEARCH_MAX_LIMIT} at most.

The response is markdown: one heading per result with a link to the page, a
link to its markdown version and a snippet. It returns source material, not a
generated answer. Matching is lexical, so a few keywords work better than a
long sentence.

## Example

\`\`\`
curl "${SITE_URL}${AGENT_SEARCH_PATH}?q=status+page+custom+domain"
\`\`\`

## Related

- [llms.txt](${SITE_URL}/llms.txt)
- [Sitemap](${SITE_URL}/sitemap.xml)
- [OpenAPI specification](${SITE_URL}/openapi.json)
- [MCP server card](${SITE_URL}/.well-known/mcp.json)
`;
}

// The query is caller-chosen and lands in a code span an agent reads:
// dropping backticks and line breaks keeps it from closing the span.
function inlineCode(text: string) {
  return `\`${text.replace(/[`\r\n]+/g, " ").trim()}\``;
}

// Search hrefs carry `?q=` for the on-page highlighter; agents get the clean
// page URL, the heading anchor and the markdown twin instead.
function resultLinks(href: string) {
  const url = new URL(href, SITE_URL);
  const path = url.pathname === "/" ? "/index" : url.pathname;
  return {
    page: `${SITE_URL}${url.pathname}${url.hash}`,
    markdown: `${SITE_URL}${path}.md`,
  };
}

export function renderSearchMarkdown(args: {
  query: string;
  results: SearchResult[];
  limit: number;
}): string {
  const { query, results, limit } = args;
  const shown = results.slice(0, limit);
  const heading = `# Search results for ${inlineCode(query)}`;

  if (shown.length === 0) {
    return `${heading}

No results. Try fewer or different keywords, or browse [llms.txt](${SITE_URL}/llms.txt).
`;
  }

  const count =
    results.length > shown.length
      ? `Showing ${shown.length} of ${results.length} results, best match first.`
      : `${shown.length} ${shown.length === 1 ? "result" : "results"}, best match first.`;

  const blocks = shown.map((result, i) => {
    const { page, markdown } = resultLinks(result.href);
    const lines = [
      `## ${i + 1}. [${result.metadata.title}](${page})`,
      "",
      `- Type: ${CORPUS_LABELS[result.type]}`,
      ...(result.tier ? [`- Match: ${result.tier}`] : []),
      `- Markdown: ${markdown}`,
    ];
    const snippet = result.content.trim();
    if (snippet) lines.push("", snippet);
    return lines.join("\n");
  });

  return `${heading}\n\n${count}\n\n${blocks.join("\n\n")}\n`;
}
