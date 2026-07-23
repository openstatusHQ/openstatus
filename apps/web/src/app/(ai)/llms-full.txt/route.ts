import { convertMdxToMarkdown } from "../../../content/convert";
import {
  PRODUCT_CONTEXT_MARKDOWN,
  PRODUCT_SUMMARY,
} from "../../../content/llms-context";
import {
  type MDXData,
  getHomePage,
  getProductPages,
  getToolingPages,
  getUnrelatedPages,
} from "../../../content/utils";

export const runtime = "nodejs";
export const revalidate = 3600;

const BASE = "https://www.openstatus.dev";

function renderPage(page: MDXData): string {
  const md = convertMdxToMarkdown(page);
  return `<!-- ${BASE}${page.href} -->\n\n${md}`;
}

export function GET() {
  const pages: MDXData[] = [
    getHomePage(),
    ...getProductPages(),
    ...getToolingPages(),
    ...getUnrelatedPages().filter((p) => p.slug !== "not-found"),
  ];

  const chunks = pages.map(renderPage);

  const intro = [
    "# openstatus — full content",
    "",
    `> ${PRODUCT_SUMMARY} Blog posts, changelog entries, guides, use cases, and comparisons live in [llms.txt](https://www.openstatus.dev/llms.txt) as links — not inlined here.`,
    "",
    PRODUCT_CONTEXT_MARKDOWN,
    "",
    "---",
    "",
  ].join("\n");

  const body = `${intro}${chunks.join("\n\n---\n\n")}\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
