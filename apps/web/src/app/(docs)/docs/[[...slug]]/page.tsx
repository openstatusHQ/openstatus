import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
} from "../../../(landing)/content-box";
import { ContentPagination } from "../../../(landing)/content-pagination";
import {
  getDocs,
  getDocsPage,
  getDocsPagination,
  gitLastModified,
  validateDocsNav,
} from "../../../../content/docs";
import { DocsFeedback } from "../../../../content/docs-feedback";
import { DocsSubNav } from "../../../../content/docs-sub-nav";
import { TableOfContents } from "../../../../content/docs-toc";
import {
  type DocsNavNode,
  docsNavTree,
  findDocsNode,
  findDocsTrail,
  getDocsContainerSlugs,
} from "../../../../content/docs.config";
import { CustomMDX } from "../../../../content/mdx";
import { Grid } from "../../../../content/mdx-components/grid";
import { extractHeadings } from "../../../../content/toc";
import { JsonLd } from "../../../../lib/metadata/json-ld";
import {
  BASE_URL,
  getPageMetadata,
  getSocialMetadata,
} from "../../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDHowTo,
  getJsonLDItemList,
  getJsonLDOrganization,
  getJsonLDTechArticle,
} from "../../../../lib/metadata/structured-data";

export const dynamicParams = false;

const EDIT_BASE =
  "https://github.com/openstatusHQ/openstatus/edit/main/apps/web/src/content/pages/docs";

const DOCS_DESCRIPTION =
  "Learn how to create your status page, monitor your endpoints, and configure notifications with openstatus.";

type Params = { slug?: string[] };

// Hub pages (the /docs root and section landings) have no backing MDX file.
function getHubMetadata(title: string, href: string): Metadata {
  const url = `${BASE_URL}${href}`;
  return {
    title,
    description: DOCS_DESCRIPTION,
    alternates: { canonical: url },
    ...getSocialMetadata({
      title,
      description: DOCS_DESCRIPTION,
      url,
      category: "docs",
    }),
  };
}

export function generateStaticParams(): Params[] {
  const { errors, warnings } = validateDocsNav();
  for (const w of warnings) console.warn(`[docs] ${w}`);
  if (errors.length > 0) {
    const message = `docs nav validation failed:\n${errors.join("\n")}`;
    if (process.env.NODE_ENV === "production") throw new Error(message);
    for (const e of errors) console.warn(`[docs] ERROR ${e}`);
  }
  return [
    { slug: [] },
    ...getDocsContainerSlugs().map((s) => ({ slug: s.split("/") })),
    ...getDocs().map((d) => ({ slug: d.slug.split("/") })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata | undefined> {
  const { slug } = await params;
  if (!slug || slug.length === 0) {
    return getHubMetadata("openstatus documentation", "/docs");
  }
  const joined = slug.join("/");
  const doc = getDocsPage(joined);
  if (!doc) {
    const node = findDocsNode(docsNavTree(), `/docs/${joined}`);
    if (node?.children?.length) {
      return getHubMetadata(
        `${node.label} — openstatus docs`,
        `/docs/${joined}`,
      );
    }
    return;
  }
  return getPageMetadata(doc, "docs");
}

// A container node (the /docs hub or a section) → one card per child. Same nav
// tree the markdown listing walks, so HTML and markdown can't drift.
function DocsContainerLanding({ node }: { node: DocsNavNode }) {
  const trail = findDocsTrail(docsNavTree(), node.href);
  // ItemList mirrors the rendered cards: use each child's href (section hubs
  // point at the hub, not the leaf doc whose slug they happen to carry).
  const cardEntries = (node.children ?? []).map((card) => ({
    name: card.label,
    url: `${BASE_URL}${card.href}`,
    description: card.slug
      ? getDocsPage(card.slug)?.metadata.description
      : undefined,
  }));

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Docs", url: `${BASE_URL}/docs` },
      ...(trail ?? []).slice(1).map((n) => ({
        name: n.label,
        url: `${BASE_URL}${n.href}`,
      })),
    ]),
    getJsonLDItemList(cardEntries),
  ]);

  return (
    <div className="min-w-0 flex-1 space-y-8">
      <JsonLd graph={jsonLDGraph} />
      <DocsSubNav />
      <section className="prose dark:prose-invert max-w-none">
        <h1>{node.label}</h1>
        {node.description ? <p>{node.description}</p> : null}
        <Grid cols={2}>
          {node.children?.map((card) => {
            const description = card.slug
              ? getDocsPage(card.slug)?.metadata.description
              : undefined;
            return (
              <ContentBoxLink key={card.href} href={card.href}>
                <ContentBoxTitle>{card.label}</ContentBoxTitle>
                {description ? (
                  <ContentBoxDescription>{description}</ContentBoxDescription>
                ) : null}
              </ContentBoxLink>
            );
          })}
        </Grid>
      </section>
    </div>
  );
}

export default async function DocsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const joined = slug?.join("/") ?? "";

  const doc = joined ? getDocsPage(joined) : undefined;

  if (!doc) {
    const node = findDocsNode(
      docsNavTree(),
      joined ? `/docs/${joined}` : "/docs",
    );
    if (node?.children?.length) return <DocsContainerLanding node={node} />;
    notFound();
  }

  const toc = extractHeadings(doc.content);
  const { prev, next } = getDocsPagination(joined);
  const lastUpdated = gitLastModified(doc.filePath);

  const trail = findDocsTrail(docsNavTree(), doc.href);
  // trail[0] is the /docs root; nest each ancestor hub, leaf shows the page title.
  const nestedCrumbs = trail
    ? trail.slice(1).map((node, i, arr) => ({
        name: i === arr.length - 1 ? doc.metadata.title : node.label,
        url: `${BASE_URL}${node.href}`,
      }))
    : [{ name: doc.metadata.title, url: `${BASE_URL}${doc.href}` }];

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDTechArticle(doc),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Docs", url: `${BASE_URL}/docs` },
      ...nestedCrumbs,
    ]),
    getJsonLDHowTo(doc),
    getJsonLDFAQPage(doc),
  ]);

  return (
    <div className="flex gap-8">
      <JsonLd graph={jsonLDGraph} />
      <div className="min-w-0 flex-1 space-y-8">
        <DocsSubNav />
        <article className="prose dark:prose-invert max-w-none">
          <h1>{doc.metadata.hero ?? doc.metadata.title}</h1>
          <CustomMDX source={doc.content} />
        </article>
        <div className="space-y-4">
          <div className="text-muted-foreground flex flex-row flex-wrap justify-between gap-x-4 gap-y-2 text-sm">
            <a
              href={`${EDIT_BASE}/${joined}.mdx`}
              target="_blank"
              rel="noopener noreferrer"
              className="ease hover:text-foreground transition-colors duration-150 motion-reduce:transition-none"
            >
              Edit this page on GitHub
            </a>
            {lastUpdated ? (
              <span>
                Last updated{" "}
                {lastUpdated.toLocaleDateString("en-us", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                })}
              </span>
            ) : null}
          </div>

          <ContentPagination prev={prev} next={next} />
        </div>
      </div>

      <aside className="hidden w-56 shrink-0 xl:block">
        <div className="sticky top-4 max-h-[calc(100vh-2rem)] space-y-2 overflow-y-auto">
          <TableOfContents items={toc} />
          <DocsFeedback />
        </div>
      </aside>
    </div>
  );
}
