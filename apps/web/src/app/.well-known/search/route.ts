import {
  parseSearchLimit,
  renderSearchMarkdown,
  searchUsageMarkdown,
} from "../../../content/agent-search";
import { searchCorpus } from "../../../content/utils/search-index";

export const runtime = "nodejs";

const HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300, s-maxage=3600",
};

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return new Response(searchUsageMarkdown(), { headers: HEADERS });
  }

  const results = searchCorpus({ p: "all", q: query });
  const limit = parseSearchLimit(searchParams.get("limit"));

  return new Response(renderSearchMarkdown({ query, results, limit }), {
    headers: HEADERS,
  });
}
