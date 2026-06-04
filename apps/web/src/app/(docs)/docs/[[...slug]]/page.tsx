import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
} from "@/app/(landing)/content-box";
import { ContentPagination } from "@/app/(landing)/content-pagination";
import {
  getDocs,
  getDocsPage,
  getDocsPagination,
  gitLastModified,
  validateDocsNav,
} from "@/content/docs";
import { DocsSubNav } from "@/content/docs-sub-nav";
import { TableOfContents } from "@/content/docs-toc";
import {
  type DocsNavSection,
  docsNav,
  getParentSlugs,
  isExternalItem,
  sectionForParentSlug,
  sectionParentSlug,
} from "@/content/docs.config";
import { CustomMDX } from "@/content/mdx";
import { Grid } from "@/content/mdx-components/grid";
import { extractHeadings } from "@/content/toc";
import { BASE_URL } from "@/lib/metadata/shared-metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamicParams = false;

const EDIT_BASE =
  "https://github.com/openstatusHQ/openstatus/edit/main/apps/web/src/content/pages/docs";

type Params = { slug?: string[] };

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
    ...getParentSlugs().map((s) => ({ slug: s.split("/") })),
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
    return {
      title: "openstatus documentation",
      description:
        "Learn how to create your status page, monitor your endpoints, and configure notifications with openstatus.",
      alternates: { canonical: `${BASE_URL}/docs` },
    };
  }
  const joined = slug.join("/");
  const doc = getDocsPage(joined);
  if (!doc) {
    const section = sectionForParentSlug(joined);
    if (section) {
      return {
        title: `${section.label} — openstatus docs`,
        alternates: { canonical: `${BASE_URL}/docs/${joined}` },
      };
    }
    return;
  }
  return {
    title: doc.metadata.title,
    description: doc.metadata.description,
    alternates: { canonical: `${BASE_URL}${doc.href}` },
  };
}

type DocsCard = { href: string; title: string; description?: string };

function DocsGrid({
  title,
  description,
  cards,
}: {
  title: string;
  description?: string;
  cards: DocsCard[];
}) {
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      <Grid cols={2}>
        {cards.map((card) => (
          <ContentBoxLink key={card.href} href={card.href}>
            <ContentBoxTitle>{card.title}</ContentBoxTitle>
            {card.description ? (
              <ContentBoxDescription>{card.description}</ContentBoxDescription>
            ) : null}
          </ContentBoxLink>
        ))}
      </Grid>
    </section>
  );
}

// /docs → one card per section, linking to the section landing.
function HubLanding() {
  const cards: DocsCard[] = docsNav.flatMap((section) => {
    const parent = sectionParentSlug(section);
    if (!parent) return [];
    const first = section.items.find((i) => !isExternalItem(i));
    const overview =
      first && !isExternalItem(first) ? getDocsPage(first.slug) : undefined;
    return [
      {
        href: `/docs/${parent}`,
        title: section.label,
        description: overview?.metadata.description,
      },
    ];
  });
  return (
    <DocsGrid
      title="openstatus documentation"
      description="Learn how to create your status page, monitor your endpoints, and configure notifications."
      cards={cards}
    />
  );
}

// /docs/<section> → one card per page in that section.
function SectionLanding({ section }: { section: DocsNavSection }) {
  const cards: DocsCard[] = section.items.flatMap((item) =>
    isExternalItem(item)
      ? []
      : [
          {
            href: `/docs/${item.slug}`,
            title: item.label,
            description: getDocsPage(item.slug)?.metadata.description,
          },
        ],
  );
  return <DocsGrid title={section.label} cards={cards} />;
}

export default async function DocsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  if (!slug || slug.length === 0) return <HubLanding />;

  const joined = slug.join("/");
  const doc = getDocsPage(joined);
  if (!doc) {
    const section = sectionForParentSlug(joined);
    if (section) return <SectionLanding section={section} />;
    notFound();
  }

  const toc = extractHeadings(doc.content);
  const { prev, next } = getDocsPagination(joined);
  const lastUpdated = gitLastModified(doc.filePath);

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1 space-y-8">
        <DocsSubNav />
        <article className="prose dark:prose-invert max-w-none font-sans">
          <h1>{doc.metadata.title}</h1>
          <CustomMDX source={doc.content} />
        </article>
        <div className="space-y-4">
          <div className="flex flex-row flex-wrap justify-between gap-x-4 gap-y-2 text-muted-foreground text-sm">
            <a
              href={`${EDIT_BASE}/${joined}.mdx`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
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

      <aside className="hidden w-48 shrink-0 xl:block">
        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
          <TableOfContents items={toc} />
        </div>
      </aside>
    </div>
  );
}
