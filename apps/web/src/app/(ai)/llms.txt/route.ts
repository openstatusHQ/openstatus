import {
  PRODUCT_CONTEXT_MARKDOWN,
  PRODUCT_SUMMARY,
} from "../../../content/llms-context";
import {
  type MDXData,
  getBlogPosts,
  getChangelogPosts,
  getComparePages,
  getDocPages,
  getGuides,
  getProductPages,
  getToolingPages,
  getToolsPages,
  getUnrelatedPages,
  getUseCasePages,
} from "../../../content/utils";

export const runtime = "nodejs";
export const revalidate = 3600;

const BASE = "https://www.openstatus.dev";

type Item = { title: string; href: string; description?: string };

function toItem(page: MDXData, withDescription = false): Item {
  return {
    title: page.metadata.title,
    href: page.href,
    description: withDescription ? page.metadata.description : undefined,
  };
}

function renderSection(title: string, items: Item[]): string {
  if (!items.length) return "";
  const lines = items
    .map((it) =>
      it.description
        ? `- [${it.title}](${BASE}${it.href}): ${it.description}`
        : `- [${it.title}](${BASE}${it.href})`,
    )
    .join("\n");
  return `## ${title}\n\n${lines}\n`;
}

export function GET() {
  const body = [
    "# openstatus",
    "",
    `> ${PRODUCT_SUMMARY}`,
    "",
    PRODUCT_CONTEXT_MARKDOWN,
    "",
    renderSection(
      "Product",
      getProductPages().map((p) => toItem(p, true)),
    ),
    renderSection(
      "Tooling",
      getToolingPages().map((p) => toItem(p, true)),
    ),
    renderSection(
      "Documentation",
      getDocPages().map((p) => toItem(p, true)),
    ),
    renderSection(
      "Guides",
      getGuides().map((p) => toItem(p, true)),
    ),
    renderSection(
      "Use Cases",
      getUseCasePages().map((p) => toItem(p, true)),
    ),
    renderSection(
      "Comparisons",
      getComparePages().map((p) => toItem(p, true)),
    ),
    renderSection(
      "Playground",
      getToolsPages().map((p) => toItem(p, true)),
    ),
    renderSection(
      "Pages",
      getUnrelatedPages()
        .filter((p) => p.slug !== "not-found")
        .map((p) => toItem(p, true)),
    ),
    renderSection(
      "Blog",
      getBlogPosts().map((p) => toItem(p)),
    ),
    renderSection(
      "Changelog",
      getChangelogPosts().map((p) => toItem(p)),
    ),
    "## Optional",
    "",
    "- [API OpenAPI](https://api.openstatus.dev/openapi)",
    "- [GitHub](https://github.com/openstatushq/openstatus)",
    "- [SDK (JSR)](https://jsr.io/@openstatus/sdk-node)",
    "- [Theme Store](https://themes.openstatus.dev)",
    "- [Dashboard](https://app.openstatus.dev)",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
