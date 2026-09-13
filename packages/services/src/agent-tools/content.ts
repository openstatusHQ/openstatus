import { z } from "zod";

import type { AgentTool } from "./types";

// Public marketing-site content API; override for local/self-hosted setups.
const WEB_BASE_URL =
  process.env.OPENSTATUS_WEB_BASE_URL ?? "https://www.openstatus.dev";

const MAX_RESULTS = 8;
const FETCH_TIMEOUT_MS = 10_000;
// ≈6k tokens — the free tier runs Haiku; a clipped page beats a blown context.
const MAX_MARKDOWN_CHARS = 24_000;

// Mirrors `PAGE_TYPES` in apps/web/src/content/utils — the corpora /api/search accepts.
const CONTENT_TYPES = [
  "all",
  "docs",
  "guides",
  "changelog",
  "blog",
  "product",
  "compare",
  "use-case",
  "customers",
  "tooling",
  "tools",
  "unrelated",
] as const;

// Site-relative slug path only (`docs/concept/monitor`, `pricing`) — blocks
// traversal and absolute URLs; /api/markdown decides whether the page exists.
const SAFE_PATH = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;

const SearchContentInput = z
  .object({
    query: z.string().min(1),
    type: z.enum(CONTENT_TYPES).default("all"),
  })
  .strict();

const SearchContentOutput = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      type: z.string(),
      snippet: z.string(),
      url: z.string(),
      path: z.string(),
    }),
  ),
  error: z.string().optional(),
});

export const searchContentTool: AgentTool<
  z.infer<typeof SearchContentInput>,
  z.infer<typeof SearchContentOutput>
> = {
  name: "search_content",
  description:
    "Search every public openstatus.dev page — marketing/product pages (pricing, features), blog, comparisons, use cases, customer stories, tooling, plus docs/guides/changelog. Broader than search_docs; prefer search_docs for pure how-to questions. Narrow with `type`. Returns scored results with title, type, snippet, url, and a path usable with get_content_page.",
  scope: "read",
  destructive: false,
  inputSchema: SearchContentInput,
  outputSchema: SearchContentOutput,
  // A content lookup failure should degrade the answer, not abort the chat turn.
  async run({ input }) {
    try {
      // Adapters parse through the schema, but direct callers may skip the default.
      const { query, type = "all" } = input;
      const res = await fetch(
        `${WEB_BASE_URL}/api/search?p=${type}&q=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      );
      if (!res.ok) {
        return {
          results: [],
          error: `search unavailable (HTTP ${res.status})`,
        };
      }
      const body = (await res.json()) as unknown;
      if (!Array.isArray(body)) {
        return {
          results: [],
          error: "search unavailable (unexpected response)",
        };
      }
      // Pick fields defensively — the web app's response shape can drift.
      const results = body
        .flatMap((el) => {
          const item = el as {
            metadata?: { title?: unknown; description?: unknown };
            type?: unknown;
            content?: unknown;
            href?: unknown;
          };
          const title = item.metadata?.title;
          const href = item.href;
          if (typeof title !== "string" || typeof href !== "string") return [];
          // Homepage (href "/") has no slug path get_content_page can fetch.
          const path = href.split(/[?#]/)[0].replace(/^\//, "");
          if (!path) return [];
          return [
            {
              title,
              description:
                typeof item.metadata?.description === "string"
                  ? item.metadata.description
                  : undefined,
              type: typeof item.type === "string" ? item.type : "page",
              snippet: typeof item.content === "string" ? item.content : "",
              url: `${WEB_BASE_URL}${href}`,
              path,
            },
          ];
        })
        .slice(0, MAX_RESULTS);
      return { results };
    } catch {
      return { results: [], error: "search unavailable (network error)" };
    }
  },
};

const GetContentPageInput = z.object({ path: z.string().min(1) }).strict();

const GetContentPageOutput = z.object({
  url: z.string(),
  markdown: z.string(),
  truncated: z.boolean(),
  error: z.string().optional(),
});

export const getContentPageTool: AgentTool<
  z.infer<typeof GetContentPageInput>,
  z.infer<typeof GetContentPageOutput>
> = {
  name: "get_content_page",
  description:
    "Fetch the full markdown content of any public openstatus.dev page by path (as returned by search_content), e.g. pricing, blog/…, compare/…, use-case/…. Superset of get_doc_page.",
  scope: "read",
  destructive: false,
  inputSchema: GetContentPageInput,
  outputSchema: GetContentPageOutput,
  async run({ input }) {
    // Loop instead of /\/+$/ — CodeQL flags that regex as polynomial on
    // untrusted input.
    let path = input.path;
    while (path.startsWith("/")) path = path.slice(1);
    while (path.endsWith("/")) path = path.slice(0, -1);
    const url = `${WEB_BASE_URL}/${path}`;
    if (!SAFE_PATH.test(path)) {
      return {
        url,
        markdown: "",
        truncated: false,
        error:
          "path must be a site-relative page path like docs/concept/monitor",
      };
    }
    try {
      // No Accept: text/markdown header — the site middleware rewrites any
      // request carrying it to /api/markdown/<path>, doubling the prefix → 404.
      const res = await fetch(`${WEB_BASE_URL}/api/markdown/${path}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        return {
          url,
          markdown: "",
          truncated: false,
          error:
            res.status === 404
              ? `page not found (HTTP ${res.status})`
              : `page unavailable (HTTP ${res.status})`,
        };
      }
      const text = await res.text();
      if (text.length <= MAX_MARKDOWN_CHARS) {
        return { url, markdown: text, truncated: false };
      }
      return {
        url,
        markdown: `${text.slice(0, MAX_MARKDOWN_CHARS)}\n\n[truncated — content continues at ${url}]`,
        truncated: true,
      };
    } catch {
      return {
        url,
        markdown: "",
        truncated: false,
        error: "page unavailable (network error)",
      };
    }
  },
};
