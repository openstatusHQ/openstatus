import { z } from "zod";

import type { AgentTool } from "./types";

// Public marketing-site content API; override for local/self-hosted setups.
const WEB_BASE_URL =
  process.env.OPENSTATUS_WEB_BASE_URL ?? "https://www.openstatus.dev";

const MAX_RESULTS = 8;
const FETCH_TIMEOUT_MS = 10_000;
// ≈6k tokens — the free tier runs Haiku; a clipped page beats a blown context.
const MAX_MARKDOWN_CHARS = 24_000;

const DOC_PATH_PREFIXES = ["docs/", "guides/", "changelog/"];

const SearchDocsInput = z
  .object({
    query: z.string().min(1),
    type: z.enum(["docs", "guides", "changelog"]).default("docs"),
  })
  .strict();

const SearchDocsOutput = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      snippet: z.string(),
      url: z.string(),
      path: z.string(),
    }),
  ),
  error: z.string().optional(),
});

export const searchDocsTool: AgentTool<
  z.infer<typeof SearchDocsInput>,
  z.infer<typeof SearchDocsOutput>
> = {
  name: "search_docs",
  description:
    "Search the public openstatus documentation, guides, or changelog. Returns scored results with title, snippet, url, and a path usable with get_doc_page.",
  scope: "read",
  destructive: false,
  inputSchema: SearchDocsInput,
  outputSchema: SearchDocsOutput,
  // A docs lookup failure should degrade the answer, not abort the chat turn.
  async run({ input }) {
    try {
      const { query, type } = input;
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
            content?: unknown;
            href?: unknown;
          };
          const title = item.metadata?.title;
          const href = item.href;
          if (typeof title !== "string" || typeof href !== "string") return [];
          return [
            {
              title,
              description:
                typeof item.metadata?.description === "string"
                  ? item.metadata.description
                  : undefined,
              snippet: typeof item.content === "string" ? item.content : "",
              url: `${WEB_BASE_URL}${href}`,
              path: href.split(/[?#]/)[0].replace(/^\//, ""),
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

const GetDocPageInput = z.object({ path: z.string().min(1) }).strict();

const GetDocPageOutput = z.object({
  url: z.string(),
  markdown: z.string(),
  truncated: z.boolean(),
  error: z.string().optional(),
});

export const getDocPageTool: AgentTool<
  z.infer<typeof GetDocPageInput>,
  z.infer<typeof GetDocPageOutput>
> = {
  name: "get_doc_page",
  description:
    "Fetch the full markdown content of a documentation, guide, or changelog page by path (as returned by search_docs).",
  scope: "read",
  destructive: false,
  inputSchema: GetDocPageInput,
  outputSchema: GetDocPageOutput,
  async run({ input }) {
    const path = input.path.replace(/^\//, "");
    const url = `${WEB_BASE_URL}/${path}`;
    // Allowlist keeps this a docs reader, not a generic URL fetcher.
    if (
      !DOC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
      path.includes("..")
    ) {
      return {
        url,
        markdown: "",
        truncated: false,
        error: "path must start with docs/, guides/ or changelog/",
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
          error: `page not found (HTTP ${res.status})`,
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
