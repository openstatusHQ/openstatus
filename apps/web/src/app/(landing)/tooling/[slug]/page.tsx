import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomMDX } from "../../../../content/mdx";
import { getToolingPages } from "../../../../content/utils";
import { JsonLd } from "../../../../lib/metadata/json-ld";
import {
  BASE_URL,
  getPageMetadata,
} from "../../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDHowTo,
  getJsonLDOrganization,
  getJsonLDWebPage,
} from "../../../../lib/metadata/structured-data";

export const dynamicParams = false;

export async function generateStaticParams() {
  const pages = getToolingPages();

  return pages.map((page) => ({
    slug: page.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await params;
  const page = getToolingPages().find((page) => page.slug === slug);
  if (!page) {
    return;
  }

  const metadata = getPageMetadata(page, "tooling");

  return metadata;
}

export default async function ToolingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getToolingPages().find((page) => page.slug === slug);

  if (!page) {
    notFound();
  }

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDWebPage(page),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Tooling", url: `${BASE_URL}/tooling` },
      { name: page.metadata.title, url: `${BASE_URL}/tooling/${slug}` },
    ]),
    getJsonLDHowTo(page),
    getJsonLDFAQPage(page),
  ]);

  return (
    <section className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>{page.metadata.hero ?? page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <CustomMDX source={page.content} />
    </section>
  );
}
